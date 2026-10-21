// ================================================
// GLOBAL DEBUG CONFIGURATION
// ================================================
// Set to true to enable debug logging, false for production
window.SVEMY_DEBUG = true; // TEMPORARILY ENABLED FOR DEBUGGING

/**
 * Debug logger - only logs when DEBUG is true
 * @param {...any} args - Arguments to log
 */
window.SVEMY_LOG = window.SVEMY_DEBUG
  ? console.log.bind(console)
  : () => {};

/**
 * Debug warning logger - only logs when DEBUG is true
 * @param {...any} args - Arguments to log
 */
window.SVEMY_WARN = window.SVEMY_DEBUG
  ? console.warn.bind(console)
  : () => {};

// Local aliases for convenience within IIFE
const DEBUG = window.SVEMY_DEBUG;
const log = window.SVEMY_LOG;
const warn = window.SVEMY_WARN;

(function () {
  "use strict";

  // ================================================
  // CONFIGURATION
  // ================================================

  const CONFIG = {
    // Page dimensions (US Letter format: 8.5" x 11")
    PAGE_HEIGHT_MM: 279,
    PAGE_WIDTH_MM: 216,

    // Padding from .page-inner CSS (top, bottom, sides)
    PADDING_TOP_MM: 15,
    PADDING_BOTTOM_MM: 10,
    PADDING_SIDE_MM: 16,

    // Approximate component heights (measured from actual rendering)
    HEADER_HEIGHT_MM: 14, // .section-header or .page-header
    FOOTER_HEIGHT_MM: 10, // .page-footer

    // Safety buffer to prevent edge-case overflow
    BUFFER_PX: 32,

    // Conversion factor: millimeters to pixels at 96 DPI
    MM_TO_PX: 3.7795275591,
  };

  // Calculate available content area (page height minus headers, footers, padding)
  const AVAILABLE_CONTENT_HEIGHT_PX =
    (CONFIG.PAGE_HEIGHT_MM -
      CONFIG.PADDING_TOP_MM -
      CONFIG.PADDING_BOTTOM_MM -
      CONFIG.HEADER_HEIGHT_MM -
      CONFIG.FOOTER_HEIGHT_MM) *
      CONFIG.MM_TO_PX -
    CONFIG.BUFFER_PX;

  log(
    `[Pagination] Available content height: ${Math.round(
      AVAILABLE_CONTENT_HEIGHT_PX,
    )}px`,
  );

  // ================================================
  // UTILITY FUNCTIONS
  // ================================================

  /**
   * Measure the actual height of an element including margins
   * @param {HTMLElement|null|undefined} element - Element to measure
   * @returns {number} Total height in pixels, or 0 if element is invalid
   * @throws {Error} If element measurement fails unexpectedly
   */
  function getElementHeight(element) {
    if (!element) return 0;

    try {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const marginTop = parseFloat(style.marginTop) || 0;
      const marginBottom = parseFloat(style.marginBottom) || 0;

      return rect.height + marginTop + marginBottom;
    } catch (error) {
      warn("[getElementHeight] Error measuring element:", error);
      return 0;
    }
  }

  /**
   * Check if element should remain intact (not split across pages)
   * Elements like tables, code blocks, callouts should never break mid-content
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element must stay together
   */
  function shouldKeepIntact(element) {
    const keepIntactSelectors = [
      ".subsection",
      "article",
      ".callout",
      "table",
      "pre",
      "blockquote",
      ".card",
      ".color-palette",
      ".color-group",
      "figure",
      ".document-section",
      // Navigation items should never be split
      ".document-navigation > li",
      ".document-navigation li > ul > li",
    ];

    return keepIntactSelectors.some((selector) =>
      element.matches(selector),
    );
  }

  // ================================================
  // CONTENT SPLITTING ALGORITHM
  // ================================================

  /**
   * Split main content into page-sized chunks
   *
   * Algorithm:
   * 1. Accumulate elements in currentPage array
   * 2. Track cumulative height in currentHeight
   * 3. When adding next element would overflow:
   *    - Close current page (push to pages array)
   *    - Start new page with the overflowing element
   * 4. Special case: if element is larger than max height,
   *    put it on its own page (better than splitting it)
   * 5. Special handling for navigation: split by <li> items
   *
   * @param {HTMLElement} mainElement - Main content container
   * @param {number} maxHeight - Maximum height per page in pixels
   * @returns {Array<Array<HTMLElement>>} Array of page content arrays, empty array on error
   * @throws {Error} If mainElement is invalid or splitting fails
   */
  function splitContentIntoPages(mainElement, maxHeight) {
    if (!mainElement || !(mainElement instanceof HTMLElement)) {
      warn("[splitContentIntoPages] Invalid mainElement provided");
      return [];
    }

    if (typeof maxHeight !== "number" || maxHeight <= 0) {
      warn("[splitContentIntoPages] Invalid maxHeight:", maxHeight);
      return [];
    }

    try {
      const pages = [];

      // Special handling for Table of Contents navigation
      const nav = mainElement.querySelector(".document-navigation");
      if (nav) {
        const navItems = Array.from(nav.querySelectorAll(":scope > li"));
        // Only use special navigation splitting if navigation has items
        // Otherwise, treat as regular content (navigation will be built later)
        if (navItems.length > 0) {
          log(
            `[Split] Detected navigation list with ${navItems.length} items, splitting by <li> items`,
          );
          return splitNavigationIntoPages(mainElement, nav, maxHeight);
        } else {
          log(
            `[Split] Navigation list is empty, treating as regular content`,
          );
        }
      }

      // Regular content splitting
      const children = Array.from(mainElement.children);

      let currentPage = [];
      let currentHeight = 0;

      log(
        `[Split] Starting split. Max height: ${Math.round(maxHeight)}px`,
      );

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        // Force page break if element has data-page-break attribute
        if (
          child.dataset &&
          child.dataset.pageBreak === "before" &&
          currentPage.length > 0
        ) {
          pages.push(currentPage);
          currentPage = [];
          currentHeight = 0;
        }

        const childHeight = getElementHeight(child);
        const isIntact = shouldKeepIntact(child);

        log(
          `[Split] Element ${i}: ${child.tagName}.${
            child.className
          } - ${Math.round(childHeight)}px ${isIntact ? "(intact)" : ""}`,
        );

        // CASE 1: Element is larger than entire page
        // Put it on its own page even if it overflows (better than splitting)
        if (childHeight > maxHeight) {
          log(`[Split]   → Element exceeds page height`);

          // Close current page if it has content
          if (currentPage.length > 0) {
            log(
              `[Split]   → Closing current page with ${currentPage.length} elements`,
            );
            pages.push(currentPage);
            currentPage = [];
            currentHeight = 0;
          }

          // Oversized element gets its own page
          log(`[Split]   → Creating dedicated page for this element`);
          pages.push([child]);
          continue;
        }

        // CASE 2: Adding element would overflow current page
        if (currentHeight + childHeight > maxHeight) {
          log(
            `[Split]   → Would overflow (${Math.round(
              currentHeight,
            )}px + ${Math.round(childHeight)}px > ${Math.round(
              maxHeight,
            )}px)`,
          );

          // Close current page
          if (currentPage.length > 0) {
            log(
              `[Split]   → Closing page with ${
                currentPage.length
              } elements (${Math.round(currentHeight)}px)`,
            );
            pages.push(currentPage);
          }

          // Start new page with this element
          log(`[Split]   → Starting new page with this element`);
          currentPage = [child];
          currentHeight = childHeight;
        }
        // CASE 3: Element fits on current page
        else {
          log(
            `[Split]   → Adding to current page (total: ${Math.round(
              currentHeight + childHeight,
            )}px)`,
          );
          currentPage.push(child);
          currentHeight += childHeight;
        }
      }

      // Add final page if it has content
      if (currentPage.length > 0) {
        log(
          `[Split] Final page: ${
            currentPage.length
          } elements (${Math.round(currentHeight)}px)`,
        );
        pages.push(currentPage);
      }

      log(`[Split] Total pages created: ${pages.length}`);
      return pages;
    } catch (error) {
      warn(
        "[splitContentIntoPages] Error during content splitting:",
        error,
      );
      return [];
    }
  }

  /**
   * Special split function for navigation lists
   * Works exactly like splitContentIntoPages, but treats each <li> as a separate element
   * This ensures navigation items are never split mid-item
   *
   * @param {HTMLElement} mainElement - Main content container
   * @param {HTMLElement} navElement - Navigation <ul> element
   * @param {number} maxHeight - Maximum height per page
   * @returns {Array<Array<HTMLElement>>} Array of page content arrays
   */
  function splitNavigationIntoPages(mainElement, navElement, maxHeight) {
    const pages = [];
    const navItems = Array.from(
      navElement.querySelectorAll(":scope > li"),
    );

    log(`[Split Nav] Found ${navItems.length} navigation items to split`);

    // If navigation is empty, return at least one page with empty nav
    if (navItems.length === 0) {
      log(
        `[Split Nav] Navigation is empty, creating single page with empty nav`,
      );
      const navClone = navElement.cloneNode(false);
      navClone.className = navElement.className;
      navClone.setAttribute(
        "data-toc-auto",
        navElement.getAttribute("data-toc-auto") || "",
      );

      const allChildren = Array.from(mainElement.children);
      const pageContent = [];

      // Clone all children, replacing nav with empty clone
      allChildren.forEach((el) => {
        if (el === navElement) {
          pageContent.push(navClone);
        } else {
          pageContent.push(el.cloneNode(true));
        }
      });

      // If nav wasn't found in children, add it
      if (!allChildren.includes(navElement)) {
        pageContent.push(navClone);
      }

      pages.push(pageContent);
      return pages;
    }

    // Get all other children of main (before and after nav)
    const allChildren = Array.from(mainElement.children);
    const navIndex = allChildren.indexOf(navElement);
    const beforeNav = allChildren.slice(0, navIndex);
    const afterNav = allChildren.slice(navIndex + 1);

    // Calculate height of elements before/after navigation
    let beforeNavHeight = 0;
    beforeNav.forEach((child) => {
      beforeNavHeight += getElementHeight(child);
    });

    let afterNavHeight = 0;
    afterNav.forEach((child) => {
      afterNavHeight += getElementHeight(child);
    });

    let currentPage = [];
    let currentHeight = beforeNavHeight; // Start with beforeNav height
    let currentNavItems = [];

    // Add beforeNav to first page (skip navigation elements to prevent duplication)
    beforeNav.forEach((el) => {
      // Defensive check: skip navigation elements even in beforeNav
      // (shouldn't happen in correct HTML structure, but prevents edge cases)
      const isNavElement =
        (el.classList && el.classList.contains("document-navigation")) ||
        el.tagName === "NAV" ||
        el.querySelector(".document-navigation") !== null;

      if (isNavElement) {
        log(
          `[Split Nav] Skipping navigation element in beforeNav (${
            el.tagName
          }.${el.className || ""}) to prevent duplication`,
        );
        return; // Skip this element
      }
      currentPage.push(el.cloneNode(true));
    });

    // Process navigation items (treat each <li> as a separate element)
    for (let i = 0; i < navItems.length; i++) {
      const navItem = navItems[i];
      const navItemHeight = getElementHeight(navItem);

      log(
        `[Split Nav] Item ${i + 1}/${navItems.length}: ${Math.round(
          navItemHeight,
        )}px (current: ${Math.round(currentHeight)}px)`,
      );

      // Check if adding this item would overflow
      if (
        currentHeight + navItemHeight > maxHeight &&
        currentNavItems.length > 0
      ) {
        // Create nav container for current page
        const navClone = navElement.cloneNode(false);
        navClone.className = navElement.className;
        navClone.setAttribute(
          "data-toc-auto",
          navElement.getAttribute("data-toc-auto") || "",
        );

        // Add all collected nav items (clone each item to avoid DOM conflicts)
        currentNavItems.forEach((item, itemIdx) => {
          const clonedItem = item.cloneNode(true);
          navClone.appendChild(clonedItem);
          log(
            `[Split Nav]   Added nav item ${itemIdx + 1} to page (has ${
              clonedItem.querySelectorAll('a[href^="#"]').length
            } links)`,
          );
        });

        // Add nav to current page
        currentPage.push(navClone);

        // Add afterNav only to last page of navigation
        // (we'll add it later to the final page)

        pages.push(currentPage);
        log(
          `[Split Nav] Created page with ${
            currentNavItems.length
          } nav items (${Math.round(currentHeight)}px)`,
        );

        // Start new page (no beforeNav on continuation pages)
        currentPage = [];
        currentHeight = 0;
        currentNavItems = [];
      }

      // Add nav item to current collection
      currentNavItems.push(navItem);
      currentHeight += navItemHeight;
    }

    // Create final nav container for last page
    if (currentNavItems.length > 0) {
      const navClone = navElement.cloneNode(false);
      navClone.className = navElement.className;
      navClone.setAttribute(
        "data-toc-auto",
        navElement.getAttribute("data-toc-auto") || "",
      );

      currentNavItems.forEach((item, itemIdx) => {
        const clonedItem = item.cloneNode(true);
        navClone.appendChild(clonedItem);
        log(
          `[Split Nav]   Added nav item ${
            itemIdx + 1
          } to final page (has ${
            clonedItem.querySelectorAll('a[href^="#"]').length
          } links)`,
        );
      });

      currentPage.push(navClone);
    }

    // Add afterNav to final page (but skip navigation elements to avoid duplication)
    afterNav.forEach((el) => {
      // CRITICAL: Skip navigation elements in afterNav to prevent duplication
      // Navigation is already distributed across pages, so we don't need it in afterNav
      // Check for:
      // 1. Elements with class "document-navigation" (the <ul>)
      // 2. Elements with tag "nav" (the <nav> wrapper)
      // 3. Elements that contain ".document-navigation" inside them
      const isNavElement =
        (el.classList && el.classList.contains("document-navigation")) ||
        el.tagName === "NAV" ||
        el.querySelector(".document-navigation") !== null;

      if (isNavElement) {
        log(
          `[Split Nav] Skipping navigation element in afterNav (${
            el.tagName
          }.${el.className || ""}) to prevent duplication`,
        );
        return; // Skip this element
      }
      currentPage.push(el.cloneNode(true));
      currentHeight += getElementHeight(el);
    });

    // Add final page if it has content
    if (currentPage.length > 0) {
      pages.push(currentPage);
      log(
        `[Split Nav] Final page with ${currentNavItems.length} nav items`,
      );
    }

    log(`[Split Nav] Total navigation pages created: ${pages.length}`);
    return pages;
  }

  // ================================================
  // PAGE GENERATION
  // ================================================

  /**
   * Create a new page element with header, content, and footer
   *
   * @param {HTMLElement} sectionHeader - Header to clone
   * @param {Array<HTMLElement>} contentNodes - Content elements for this page
   * @param {HTMLElement} footer - Footer to clone
   * @param {boolean} isFirstPage - Whether this is first page of section
   * @param {string} sectionId - Section ID for navigation reference
   * @returns {HTMLElement} Complete page element
   */
  function createPage(
    sectionHeader,
    contentNodes,
    footer,
    isFirstPage,
    sectionId,
  ) {
    const page = document.createElement("section");
    page.className = "page";

    // CRITICAL: Preserve section ID on FIRST page for back-links to work
    // Subsequent pages use data-section-id for navigation tracking only
    if (sectionId) {
      if (isFirstPage) {
        page.id = sectionId; // Actual ID for anchor links (#section-name)
      } else {
        page.setAttribute("data-section-id", sectionId); // Tracking only
      }
    }

    const pageInner = document.createElement("div");
    pageInner.className = "page-inner";

    // Clone header on continuation pages (skip if section has data-no-repeat-header)
    if (sectionHeader) {
      const noRepeat =
        sectionHeader.closest("section")?.dataset?.noRepeatHeader;
      if (isFirstPage || !noRepeat) {
        const headerClone = sectionHeader.cloneNode(true);
        pageInner.appendChild(headerClone);
      }
    }

    // Clone content nodes
    const main = document.createElement("main");
    contentNodes.forEach((node) => {
      main.appendChild(node.cloneNode(true));
    });
    pageInner.appendChild(main);

    // Clone footer
    if (footer) {
      pageInner.appendChild(footer.cloneNode(true));
    }

    page.appendChild(pageInner);
    return page;
  }

  // ================================================
  // PAGE NUMBERING
  // ================================================

  /**
   * Update page numbers in all page footers
   *
   * IMPORTANT:
   * - Cover page is NOT numbered (no visible page number).
   * - The first page AFTER the cover (Description) is page 1.
   *
   * @returns {number} Number of pages renumbered, or 0 on error
   * @throws {Error} If page numbering fails
   */
  function renumberPages() {
    try {
      const pages = document.querySelectorAll(".page:not(.page-cover)");

      log(`[Renumber] Updating ${pages.length} page numbers`);

      // Constants for page numbering
      const BASE_PAGE_NUMBER = 1; // First content page (after cover) is page 1

      let updateCount = 0;
      pages.forEach((page, index) => {
        try {
          const pageNumElement = page.querySelector(".page-number");
          if (pageNumElement) {
            const pageNumber = index + BASE_PAGE_NUMBER;
            pageNumElement.textContent = pageNumber;
            updateCount++;
          }
        } catch (error) {
          warn(`[Renumber] Error updating page ${index + 1}:`, error);
        }
      });

      log(`[Renumber] Successfully updated ${updateCount} page numbers`);
      return updateCount;
    } catch (error) {
      warn("[Renumber] Critical error during page renumbering:", error);
      return 0;
    }
  }

  // ================================================
  // NAVIGATION / TABLE OF CONTENTS
  // ================================================

  /**
   * Build Table of Contents based on actual document structure.
   *
   * Rules:
   * - Cover page is excluded.
   * - ToC is always built from actual pages in DOM order.
   * - Description and ToC entries are added as nav-no-number items.
   * - All other sections become numbered items with optional subsections.
   *
   * @returns {boolean} True if ToC was built successfully, false on error
   * @throws {Error} If ToC building fails
   */
  function buildTableOfContents() {
    try {
      log("[ToC] Starting buildTableOfContents...");

      // CRITICAL: Check if ToC has already been built and split
      // If ToC is already split across multiple pages, we should NOT rebuild it
      // to avoid duplication. Only build if main ToC page has empty navigation.
      const mainTocPage = document.getElementById("toc");
      if (mainTocPage) {
        // Check if ToC is marked as split (prevents rebuild after splitting)
        if (mainTocPage.getAttribute("data-toc-split") === "true") {
          const continuationPages = document.querySelectorAll(
            '[data-section-id="toc"]',
          );
          log(
            `[ToC] ToC is marked as split (${
              continuationPages.length + 1
            } pages). Skipping rebuild to avoid duplication.`,
          );
          return true; // Navigation already built and distributed
        }

        const navWrapper = mainTocPage.querySelector(
          'nav[role="navigation"]',
        );
        const mainNav = navWrapper
          ? navWrapper.querySelector(
              '.document-navigation[data-toc-auto="true"], .document-navigation',
            )
          : mainTocPage.querySelector(
              '.document-navigation[data-toc-auto="true"], .document-navigation',
            );

        // Check if navigation already has items (was already built)
        if (mainNav && mainNav.children.length > 0) {
          log(
            `[ToC] Navigation already exists with ${mainNav.children.length} items. Checking if rebuild is needed...`,
          );

          // Check if ToC is split across multiple pages
          const continuationPages = document.querySelectorAll(
            '[data-section-id="toc"]',
          );
          if (continuationPages.length > 0) {
            log(
              `[ToC] ToC is already split across ${
                continuationPages.length + 1
              } pages. Skipping rebuild to avoid duplication.`,
            );

            // Verify navigation distribution to detect duplication
            let totalNavItems = mainNav.children.length;
            continuationPages.forEach((contPage, idx) => {
              const contNavWrapper = contPage.querySelector(
                'nav[role="navigation"]',
              );
              const contNav = contNavWrapper
                ? contNavWrapper.querySelector(
                    '.document-navigation[data-toc-auto="true"], .document-navigation',
                  )
                : contPage.querySelector(
                    '.document-navigation[data-toc-auto="true"], .document-navigation',
                  );
              if (contNav) {
                totalNavItems += contNav.children.length;
                log(
                  `[ToC] Continuation page ${idx + 1} has ${
                    contNav.children.length
                  } navigation items`,
                );
              }
            });
            log(
              `[ToC] Total navigation items across all ToC pages: ${totalNavItems}`,
            );

            return true; // Navigation already built and distributed
          }

          // If not split, check if navigation is complete
          // If it has items, assume it's already built correctly
          log(
            `[ToC] Navigation exists but ToC is not split. Will rebuild to ensure completeness.`,
          );
        }
      }

      // Find ALL ToC pages (first page has id="toc", continuation pages have data-section-id="toc")
      const tocById = document.getElementById("toc");
      const tocByDataId = document.querySelectorAll(
        '[data-section-id="toc"]',
      );
      log(`[ToC] Found ToC by id: ${tocById ? "YES" : "NO"}`);
      log(
        `[ToC] Found ToC by data-section-id: ${tocByDataId.length} pages`,
      );

      const tocSections = [tocById, ...Array.from(tocByDataId)].filter(
        Boolean,
      ); // Remove null/undefined

      log(`[ToC] Total ToC sections found: ${tocSections.length}`);

      if (tocSections.length === 0) {
        warn(
          "[ToC] No ToC section found (neither id='toc' nor data-section-id='toc')",
        );
        return false;
      }

      // Find the main ToC section (first one with id="toc" or first one if none has id)
      const mainTocSection =
        tocSections.find((s) => s.id === "toc") || tocSections[0];

      log(
        `[ToC] Main ToC section found: ${
          mainTocSection.id ||
          mainTocSection.getAttribute("data-section-id") ||
          "unknown"
        }`,
      );

      // Find navigation element - check inside <nav> wrapper first, then direct
      const navWrapper = mainTocSection.querySelector(
        'nav[role="navigation"]',
      );
      log(`[ToC] Nav wrapper found: ${navWrapper ? "YES" : "NO"}`);

      const nav = navWrapper
        ? navWrapper.querySelector(
            '.document-navigation[data-toc-auto="true"], .document-navigation',
          )
        : mainTocSection.querySelector(
            '.document-navigation[data-toc-auto="true"], .document-navigation',
          );

      log(`[ToC] Navigation element found: ${nav ? "YES" : "NO"}`);
      if (nav) {
        log(`[ToC] Navigation element classes: ${nav.className}`);
        log(
          `[ToC] Navigation element current children: ${nav.children.length}`,
        );
      }

      if (!nav) {
        warn(
          "[ToC] .document-navigation container not found inside ToC section",
        );
        // Try to find any navigation element for debugging
        const allNavs = mainTocSection.querySelectorAll(
          "nav, .document-navigation, ul",
        );
        log(
          `[ToC] Debug: Found ${allNavs.length} potential nav elements in ToC section`,
        );
        allNavs.forEach((el, idx) => {
          log(
            `[ToC] Debug nav[${idx}]: tag=${el.tagName}, class=${el.className}, id=${el.id}`,
          );
        });
        return false;
      }

      // CRITICAL: Only clear navigation in the MAIN ToC page
      // Continuation pages will be handled during splitting
      // This prevents clearing navigation that was already distributed
      log(`[ToC] Clearing navigation in main ToC page only...`);
      const mainNavWrapper = mainTocSection.querySelector(
        'nav[role="navigation"]',
      );
      const mainNavToClear = mainNavWrapper
        ? mainNavWrapper.querySelector(
            '.document-navigation[data-toc-auto="true"], .document-navigation',
          )
        : mainTocSection.querySelector(
            '.document-navigation[data-toc-auto="true"], .document-navigation',
          );

      if (mainNavToClear) {
        const itemCount = mainNavToClear.children.length;
        mainNavToClear.innerHTML = "";
        log(`[ToC] Cleared ${itemCount} items from main ToC page`);
      } else {
        log(
          `[ToC] Warning: No navigation found in main ToC page to clear`,
        );
      }

      // Also clear continuation pages if they exist (shouldn't happen at this point, but safety check)
      if (tocByDataId.length > 0) {
        log(
          `[ToC] Warning: Found ${tocByDataId.length} continuation pages before building. Clearing them too.`,
        );
        tocByDataId.forEach((tocPage, idx) => {
          const contNavWrapper = tocPage.querySelector(
            'nav[role="navigation"]',
          );
          const contNav = contNavWrapper
            ? contNavWrapper.querySelector(
                '.document-navigation[data-toc-auto="true"], .document-navigation',
              )
            : tocPage.querySelector(
                '.document-navigation[data-toc-auto="true"], .document-navigation',
              );
          if (contNav) {
            const itemCount = contNav.children.length;
            contNav.innerHTML = "";
            log(
              `[ToC] Cleared ${itemCount} items from continuation ToC page ${
                idx + 1
              }`,
            );
          }
        });
      }

      // IMPORTANT: Only populate navigation in the main ToC section (first page)
      // Continuation pages will get their navigation items through page splitting
      // The nav element should be inside <nav> wrapper if it exists

      /**
       * Helper: create <li><a>...</a></li> navigation item
       */
      function createNavItem(id, title, options) {
        const opts = options || {};
        const noNumber = !!opts.noNumber;

        const li = document.createElement("li");
        if (noNumber) {
          li.classList.add("nav-no-number");
        }

        const a = document.createElement("a");
        a.setAttribute("href", `#${id}`);

        const numberSpan = document.createElement("span");
        numberSpan.className = "nav-number-dot";

        const textSpan = document.createElement("span");
        textSpan.className = "nav-text";
        textSpan.textContent = title;

        const pageRefSpan = document.createElement("span");
        pageRefSpan.className = "page-ref";

        a.appendChild(numberSpan);
        a.appendChild(textSpan);
        a.appendChild(pageRefSpan);
        li.appendChild(a);

        return li;
      }

      // Special entries: Description and Table of Contents themselves
      log("[ToC] Adding special entries (Description, ToC)...");
      const descriptionPage = document.getElementById("description");
      if (descriptionPage) {
        const titleOverride =
          descriptionPage.getAttribute("data-toc-title") || "Description";
        const descItem = createNavItem("description", titleOverride, {
          noNumber: true,
        });
        nav.appendChild(descItem);
        log(
          `[ToC] Added Description item. Nav now has ${nav.children.length} items`,
        );
      } else {
        log("[ToC] Description page not found");
      }

      const tocTitleOverride =
        mainTocSection.getAttribute("data-toc-title") ||
        "Table of Contents";
      const tocItem = createNavItem("toc", tocTitleOverride, {
        noNumber: true,
      });
      nav.appendChild(tocItem);
      log(
        `[ToC] Added ToC item. Nav now has ${nav.children.length} items`,
      );

      // All other content pages in actual DOM order
      const allPages = Array.from(
        document.querySelectorAll(".page:not(.page-cover)"),
      );

      log(`[ToC] Found ${allPages.length} content pages to process`);

      // Track processed sections to avoid duplicates
      // (sections split across multiple pages have id on first page, data-section-id on others)
      const processedSections = new Set();
      let sectionsAdded = 0;

      allPages.forEach((page) => {
        // Get section ID from either id or data-section-id
        const sectionId = page.id || page.getAttribute("data-section-id");

        // Skip if no section ID
        if (!sectionId) {
          return;
        }

        // Skip description and ToC themselves
        if (sectionId === "description" || sectionId === "toc") {
          return;
        }

        // Skip pages explicitly excluded from ToC
        if (page.getAttribute("data-toc-exclude") === "true") {
          return;
        }

        // Skip if this section was already processed
        // (only process the first page with id, not continuation pages with data-section-id)
        if (processedSections.has(sectionId)) {
          return;
        }

        // Only process pages that have the actual id (first page of section)
        // Continuation pages have data-section-id but no id, so we skip them here
        // but we'll collect their subsections later
        if (!page.id) {
          return;
        }

        // Mark this section as processed
        processedSections.add(sectionId);

        // Determine section title from first page
        const header =
          page.querySelector(".section-header h3") ||
          page.querySelector(".section-header .page-title") ||
          page.querySelector(".page-header .page-title");

        let sectionTitle =
          page.getAttribute("data-toc-title") ||
          (header
            ? header.textContent
                .trim()
                .replace(/\s*\(continued\)\s*$/i, "")
            : sectionId);

        // Main section nav item
        const sectionItem = createNavItem(sectionId, sectionTitle, {});

        // Collect subsections from ALL pages of this section (including continuations)
        const subList = document.createElement("ul");
        const collectedSubIds = new Set(); // Avoid duplicate subsections

        // Find all pages belonging to this section (by id or data-section-id)
        allPages.forEach((sectionPage) => {
          const pageSectionId =
            sectionPage.id || sectionPage.getAttribute("data-section-id");
          if (pageSectionId !== sectionId) {
            return; // Not part of this section
          }

          const main = sectionPage.querySelector("main");
          if (main) {
            const subsectionHeadings = main.querySelectorAll(
              "h4.subsection-title[id], .subsection-title[id]",
            );

            subsectionHeadings.forEach((subHeading) => {
              const subId = subHeading.id;
              if (!subId || collectedSubIds.has(subId)) {
                return; // Skip if no ID or already collected
              }

              collectedSubIds.add(subId);

              const linkTextSource =
                subHeading.querySelector("a") || subHeading;
              const subTitle =
                subHeading.getAttribute("data-toc-title") ||
                linkTextSource.textContent.trim();

              const subItem = createNavItem(subId, subTitle, {});
              subList.appendChild(subItem);
            });
          }
        });

        // Add subsections list if we found any
        if (subList.children.length > 0) {
          sectionItem.appendChild(subList);
        }

        nav.appendChild(sectionItem);
        sectionsAdded++;
        log(
          `[ToC] Added section "${sectionId}" (${sectionTitle}). Nav now has ${nav.children.length} items`,
        );
      });

      log(`[ToC] Processed ${sectionsAdded} sections total`);

      log(
        `[ToC] Navigation rebuilt from document structure. Total items: ${nav.children.length}`,
      );
      // Log all navigation items for debugging
      Array.from(nav.children).forEach((item, idx) => {
        const link = item.querySelector("a");
        const text = link
          ? link.querySelector(".nav-text")?.textContent
          : "unknown";
        log(`[ToC] Nav item ${idx + 1}: ${text}`);
      });
      return true;
    } catch (error) {
      warn("[ToC] Error building table of contents:", error);
      return false;
    }
  }

  /**
   * Reorder navigation items to match actual content order
   *
   * Problem: Navigation might have subsections in wrong order
   * Example: Nav shows "Callouts" then "Separators"
   *          But content has "Separators" then "Callouts"
   *
   * Solution: Extract actual order from content, reorder nav accordingly
   */
  function reorderNavigationByContentOrder() {
    log("[Navigation] Reordering navigation to match content order...");

    // CRITICAL: Only process navigation from the MAIN ToC page (id="toc")
    // Continuation pages have their navigation already split correctly
    const mainTocPage = document.getElementById("toc");
    if (!mainTocPage) {
      warn("[Navigation] Main ToC page not found, skipping reorder");
      return;
    }

    // Find navigation element in main ToC page only
    const navWrapper = mainTocPage.querySelector(
      'nav[role="navigation"]',
    );
    const mainNav = navWrapper
      ? navWrapper.querySelector(
          '.document-navigation[data-toc-auto="true"], .document-navigation',
        )
      : mainTocPage.querySelector(
          '.document-navigation[data-toc-auto="true"], .document-navigation',
        );

    if (!mainNav) {
      warn("[Navigation] Navigation not found in main ToC page");
      return;
    }

    log(
      `[Navigation] Processing navigation from main ToC page only (found ${mainNav.children.length} items)`,
    );

    // Find all navigation groups with subsections (only in main ToC page)
    const navGroups = mainNav.querySelectorAll(":scope > li");

    navGroups.forEach((navGroup) => {
      const subNav = navGroup.querySelector("ul");
      if (!subNav) return; // No subsections, skip

      const mainLink = navGroup.querySelector('a[href^="#"]');
      if (!mainLink) return;

      const sectionId = mainLink.getAttribute("href").substring(1);

      // Find ALL pages belonging to this section (including continuations)
      // First page has id="sectionId", continuation pages have data-section-id="sectionId"
      const sectionPages = [
        document.getElementById(sectionId),
        ...document.querySelectorAll(`[data-section-id="${sectionId}"]`),
      ].filter(Boolean);

      if (sectionPages.length === 0) {
        warn(`[Navigation] Section "${sectionId}" not found in content`);
        return;
      }

      // Get all subsection IDs in ACTUAL order from ALL pages of this section
      const actualSubsectionOrder = [];
      const collectedSubIds = new Set(); // Avoid duplicates

      sectionPages.forEach((sectionPage) => {
        const contentMain = sectionPage.querySelector("main");
        if (!contentMain) return;

        // Find all elements with IDs that are subsection titles
        const subsectionsInContent = contentMain.querySelectorAll(
          "h4.subsection-title[id], .subsection-title[id]",
        );

        subsectionsInContent.forEach((el) => {
          const subId = el.id;
          if (subId && !collectedSubIds.has(subId)) {
            collectedSubIds.add(subId);
            actualSubsectionOrder.push(subId);
          }
        });
      });

      if (actualSubsectionOrder.length === 0) return;

      log(
        `[Navigation] Section "${sectionId}" actual subsection order:`,
        actualSubsectionOrder,
      );

      // Get all navigation subsection items
      const navSubItems = Array.from(subNav.querySelectorAll("li"));

      // Create map of ID to nav item
      const navItemMap = new Map();
      navSubItems.forEach((li) => {
        const link = li.querySelector('a[href^="#"]');
        if (link) {
          const id = link.getAttribute("href").substring(1);
          navItemMap.set(id, li);
        }
      });

      // Clear existing subsections
      subNav.innerHTML = "";

      // Re-add in correct order based on actual content
      let reorderedCount = 0;
      actualSubsectionOrder.forEach((id) => {
        const navItem = navItemMap.get(id);
        if (navItem) {
          subNav.appendChild(navItem);
          reorderedCount++;
        }
      });

      // Add any nav items that weren't in content (edge case)
      navItemMap.forEach((navItem, id) => {
        if (!actualSubsectionOrder.includes(id)) {
          warn(
            `[Navigation] Nav item "${id}" not found in content, appending to end`,
          );
          subNav.appendChild(navItem);
        }
      });

      if (reorderedCount > 0) {
        log(
          `[Navigation] Reordered ${reorderedCount} subsections in "${sectionId}"`,
        );
      }
    });
  }

  /**
   * Update navigation page references to point to correct pages
   * after pagination splits sections
   *
   * Process:
   * 1. Find all sections with IDs
   * 2. Determine which page number each section starts on
   * 3. Update corresponding navigation links
   */
  function updateNavigationPageNumbers() {
    log("[Navigation] Updating page references in table of contents...");

    // Build map of section IDs to page numbers
    const sectionPageMap = new Map();
    const pages = document.querySelectorAll(".page:not(.page-cover)");

    pages.forEach((page, index) => {
      // First content page (after cover) is page 1
      const pageNumber = index + 1;

      // Check if page has a section ID
      const sectionId = page.id || page.getAttribute("data-section-id");
      if (sectionId) {
        // Store first occurrence (section start page)
        if (!sectionPageMap.has(sectionId)) {
          sectionPageMap.set(sectionId, pageNumber);
          log(`[Navigation] Section "${sectionId}" → Page ${pageNumber}`);
        }
      }

      // Also check for subsection IDs within main content
      const main = page.querySelector("main");
      if (main) {
        const elementsWithIds = main.querySelectorAll("[id]");
        elementsWithIds.forEach((el) => {
          const id = el.id;
          if (id && !sectionPageMap.has(id)) {
            sectionPageMap.set(id, pageNumber);
            log(`[Navigation] Subsection "${id}" → Page ${pageNumber}`);
          }
        });
      }
    });

    // CRITICAL: Only update navigation links from the MAIN ToC page (id="toc")
    // Continuation pages have their navigation already distributed correctly
    // This prevents processing the same links multiple times
    const mainTocPage = document.getElementById("toc");
    if (!mainTocPage) {
      warn(
        "[Navigation] Main ToC page not found, skipping page number updates",
      );
      return;
    }

    // Find navigation in main ToC page only
    const navWrapper = mainTocPage.querySelector(
      'nav[role="navigation"]',
    );
    const mainNav = navWrapper
      ? navWrapper.querySelector(
          '.document-navigation[data-toc-auto="true"], .document-navigation',
        )
      : mainTocPage.querySelector(
          '.document-navigation[data-toc-auto="true"], .document-navigation',
        );

    if (!mainNav) {
      warn("[Navigation] Navigation not found in main ToC page");
      return;
    }

    // Also check continuation pages, but only if they exist
    const continuationPages = document.querySelectorAll(
      '[data-section-id="toc"]',
    );
    const allTocPages = [mainTocPage, ...Array.from(continuationPages)];

    log(
      `[Navigation] Processing navigation from ${allTocPages.length} ToC pages`,
    );

    let updateCount = 0;

    // Process navigation links from ALL ToC pages (main + continuations)
    // Each page has its own subset of navigation items
    allTocPages.forEach((tocPage, pageIdx) => {
      const pageNavWrapper = tocPage.querySelector(
        'nav[role="navigation"]',
      );
      const pageNav = pageNavWrapper
        ? pageNavWrapper.querySelector(
            '.document-navigation[data-toc-auto="true"], .document-navigation',
          )
        : tocPage.querySelector(
            '.document-navigation[data-toc-auto="true"], .document-navigation',
          );

      if (!pageNav) {
        log(
          `[Navigation] No navigation found in ToC page ${pageIdx + 1}`,
        );
        return;
      }

      // CRITICAL: Only find links in DIRECT children of navigation, not nested
      // This prevents finding links from other pages that might be in DOM
      const navLinks = pageNav.querySelectorAll(
        ':scope > li > a[href^="#"]',
      );

      // Also find links in nested subsections (ul > li > a)
      const nestedLinks = pageNav.querySelectorAll(
        ':scope > li > ul > li > a[href^="#"]',
      );

      // Combine both sets
      const allNavLinks = Array.from(navLinks);
      nestedLinks.forEach((link) => {
        if (!allNavLinks.includes(link)) {
          allNavLinks.push(link);
        }
      });

      log(
        `[Navigation] ToC page ${pageIdx + 1} has ${
          allNavLinks.length
        } navigation links to process (${navLinks.length} direct, ${
          nestedLinks.length
        } nested)`,
      );

      // Log first few links for debugging
      if (allNavLinks.length > 0) {
        allNavLinks.slice(0, 5).forEach((link, idx) => {
          const href = link.getAttribute("href");
          const text =
            link.querySelector(".nav-text")?.textContent || "unknown";
          log(`[Navigation]   Link ${idx + 1}: ${text} → ${href}`);
        });
      }

      allNavLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (!href) return;

        const targetId = href.substring(1); // Remove '#'

        if (sectionPageMap.has(targetId)) {
          const pageNumber = sectionPageMap.get(targetId);
          const pageRef = link.querySelector(".page-ref");

          if (pageRef) {
            pageRef.textContent = pageNumber;
            updateCount++;
          }
        }
      });
    });

    log(
      `[Navigation] Updated ${updateCount} navigation references across ${allTocPages.length} ToC pages`,
    );
  }

  // ================================================
  // MAIN PAGINATION FUNCTION
  // ================================================

  /**
   * Main pagination orchestrator
   *
   * Process:
   * 1. Find all content pages (excluding cover)
   * 2. Measure each page's content
   * 3. If content fits → keep page as-is
   * 4. If content overflows → split into multiple pages
   * 5. Replace original pages with paginated pages
   * 6. Renumber all pages
   * 7. Update navigation references
   *
   * @returns {boolean} True if pagination completed successfully, false on error
   * @throws {Error} If critical pagination steps fail
   */
  function paginateDocument() {
    try {
      log("[Pagination] ============================================");
      log("[Pagination] STARTING DOCUMENT PAGINATION");
      log("[Pagination] ============================================");

      // Prevent double execution
      if (document.body.classList.contains("auto-paginated")) {
        log("[Pagination] Already paginated, skipping");
        return;
      }

      const startTime = performance.now();

      // Get all content pages (excluding cover)
      const originalPages = Array.from(
        document.querySelectorAll(".page:not(.page-cover)"),
      );
      log(
        `[Pagination] Found ${originalPages.length} content pages to process`,
      );

      const newPages = [];

      // Preserve cover page
      const coverPage = document.querySelector(".page-cover");
      if (coverPage) {
        newPages.push(coverPage);
        log("[Pagination] Cover page preserved");
      }

      // Process each original page
      originalPages.forEach((page, pageIndex) => {
        log(`\n[Pagination] --- Processing page ${pageIndex} ---`);

        // CRITICAL: Skip ToC page - it will be handled separately after buildTableOfContents
        // Check both id="toc" and data-section-id="toc" to catch all ToC pages
        const pageId = page.id;
        const pageSectionId = page.getAttribute("data-section-id");
        if (pageId === "toc" || pageSectionId === "toc") {
          log(
            `[Pagination] Skipping ToC page (will be processed separately)`,
          );
          return; // Skip this iteration
        }

        const pageInner = page.querySelector(".page-inner");
        if (!pageInner) {
          warn(
            `[Pagination] Page ${pageIndex} missing .page-inner, keeping as-is`,
          );
          newPages.push(page);
          return;
        }

        const main = pageInner.querySelector("main");
        const header = pageInner.querySelector(
          ".section-header, .page-header",
        );
        const footer = pageInner.querySelector(".page-footer");
        const sectionId = page.id;

        if (!main) {
          warn(
            `[Pagination] Page ${pageIndex} missing main, keeping as-is`,
          );
          newPages.push(page);
          return;
        }

        // Measure content height
        const mainHeight = getElementHeight(main);
        log(
          `[Pagination] Content height: ${Math.round(
            mainHeight,
          )}px (max: ${Math.round(AVAILABLE_CONTENT_HEIGHT_PX)}px)`,
        );

        // Content fits - keep page unchanged
        if (mainHeight <= AVAILABLE_CONTENT_HEIGHT_PX) {
          log(`[Pagination] Content fits, keeping page unchanged`);
          newPages.push(page);
          return;
        }

        // Content overflows - split it
        log(`[Pagination] OVERFLOW DETECTED! Splitting content...`);
        const contentPages = splitContentIntoPages(
          main,
          AVAILABLE_CONTENT_HEIGHT_PX,
        );
        log(
          `[Pagination] Content split into ${contentPages.length} pages`,
        );

        // If split returned no pages (edge case), keep original page
        if (contentPages.length === 0) {
          warn(
            `[Pagination] Split returned no pages, keeping original page`,
          );
          newPages.push(page);
          return;
        }

        // Create new pages from split content
        contentPages.forEach((pageContent, splitIndex) => {
          const newPage = createPage(
            header,
            pageContent,
            footer,
            splitIndex === 0, // First page of section
            sectionId,
          );
          newPages.push(newPage);

          log(
            `[Pagination] Created page (${pageContent.length} elements, ${
              splitIndex === 0 ? "first" : "continuation"
            })`,
          );
        });
      });

      log(`\n[Pagination] --- Finalization ---`);
      log(`[Pagination] Total pages generated: ${newPages.length}`);

      // Remove original pages (but preserve ToC page - it will be processed separately)
      let tocPagePreserved = false;
      originalPages.forEach((p) => {
        // CRITICAL: Don't remove ToC page - it needs to be processed by buildTableOfContents
        // Check both id="toc" and data-section-id="toc" to catch all ToC pages
        const pageId = p.id;
        const pageSectionId = p.getAttribute("data-section-id");
        if (pageId === "toc" || pageSectionId === "toc") {
          log(
            `[Pagination] Preserving ToC page (will be processed separately)`,
          );
          tocPagePreserved = true;
          return; // Skip removal
        }
        p.remove();
      });
      log(
        `[Pagination] Removed original pages${
          tocPagePreserved ? " (except ToC)" : ""
        }`,
      );

      // Insert new pages into document
      const body = document.body;
      if (coverPage) {
        // Add content pages after cover
        newPages.slice(1).forEach((page) => body.appendChild(page));
      } else {
        // No cover, add all pages
        newPages.forEach((page) => body.appendChild(page));
      }
      log(`[Pagination] Inserted new pages into document`);

      // CRITICAL: Build Table of Contents AFTER inserting new pages
      // This ensures ToC is populated with all sections (including newly created ones)
      buildTableOfContents();

      // CRITICAL: Reorder navigation to match actual content order
      // This ensures navigation items are in the correct order before ToC splitting
      reorderNavigationByContentOrder();

      // Now check if ToC page needs to be repaginated (it was built after initial pagination)
      const tocPage = document.getElementById("toc");
      if (tocPage) {
        const tocPageInner = tocPage.querySelector(".page-inner");
        if (tocPageInner) {
          const tocMain = tocPageInner.querySelector("main");
          const tocHeader = tocPageInner.querySelector(
            ".section-header, .page-header",
          );
          const tocFooter = tocPageInner.querySelector(".page-footer");

          if (tocMain) {
            const tocMainHeight = getElementHeight(tocMain);
            log(
              `[Pagination] ToC content height: ${Math.round(
                tocMainHeight,
              )}px (max: ${Math.round(AVAILABLE_CONTENT_HEIGHT_PX)}px)`,
            );

            if (tocMainHeight > AVAILABLE_CONTENT_HEIGHT_PX) {
              log(`[Pagination] ToC OVERFLOW DETECTED! Splitting ToC...`);

              // Split ToC content
              const tocContentPages = splitContentIntoPages(
                tocMain,
                AVAILABLE_CONTENT_HEIGHT_PX,
              );
              log(
                `[Pagination] ToC split into ${tocContentPages.length} pages`,
              );

              if (tocContentPages.length > 1) {
                // CRITICAL: Remove original ToC page from DOM BEFORE creating new pages
                // This ensures the original navigation doesn't interfere with new pages
                log(
                  `[Pagination] Removing original ToC page before creating split pages`,
                );
                tocPage.remove();

                // Create new ToC pages
                const body = document.body;
                const coverPage = document.querySelector(".page-cover");

                // CRITICAL: Find Description page (or last page of Description if split)
                // ToC should be inserted AFTER Description, not after cover
                let insertAfter = null;
                const descriptionPage =
                  document.getElementById("description");
                if (descriptionPage) {
                  // Find the last page with data-section-id="description" or id="description"
                  // This handles the case where Description was split into multiple pages
                  const allDescriptionPages = Array.from(
                    document.querySelectorAll(
                      'section.page[id="description"], section.page[data-section-id="description"]',
                    ),
                  );
                  if (allDescriptionPages.length > 0) {
                    // Get the last Description page in DOM order
                    insertAfter =
                      allDescriptionPages[allDescriptionPages.length - 1];
                    log(
                      `[Pagination] Found Description page(s), will insert ToC after last one`,
                    );
                  }
                }

                // Fallback: if Description not found, insert after cover
                if (!insertAfter) {
                  insertAfter = coverPage || body.firstChild;
                  log(
                    `[Pagination] Description page not found, inserting ToC after cover`,
                  );
                }

                // Store created ToC pages to set counter-reset later
                const createdTocPages = [];

                tocContentPages.forEach((pageContent, splitIndex) => {
                  // CRITICAL: Log what's in pageContent before processing
                  log(
                    `[Pagination] ToC page ${splitIndex + 1}/${
                      tocContentPages.length
                    }: pageContent has ${pageContent.length} elements`,
                  );
                  pageContent.forEach((el, idx) => {
                    const tag = el.tagName || "unknown";
                    const classes = el.className || "";
                    const isNav =
                      el.classList &&
                      el.classList.contains("document-navigation");
                    log(
                      `[Pagination]   Element ${
                        idx + 1
                      }: ${tag}.${classes} ${isNav ? "(NAVIGATION)" : ""}`,
                    );
                    if (isNav) {
                      const navItems = el.querySelectorAll(":scope > li");
                      log(
                        `[Pagination]     Navigation has ${navItems.length} direct <li> children`,
                      );
                    }
                  });

                  // CRITICAL: Check for duplicate navigation elements in pageContent
                  const navElementsInContent = pageContent.filter(
                    (el) =>
                      el.classList &&
                      el.classList.contains("document-navigation"),
                  );
                  if (navElementsInContent.length > 1) {
                    warn(
                      `[Pagination] WARNING: Found ${
                        navElementsInContent.length
                      } navigation elements in pageContent for ToC page ${
                        splitIndex + 1
                      }! Removing duplicates.`,
                    );
                    // Keep only the first navigation element, remove others
                    for (
                      let i = 1;
                      i < navElementsInContent.length;
                      i++
                    ) {
                      const index = pageContent.indexOf(
                        navElementsInContent[i],
                      );
                      if (index > -1) {
                        pageContent.splice(index, 1);
                        log(
                          `[Pagination] Removed duplicate navigation element ${
                            i + 1
                          } from pageContent`,
                        );
                      }
                    }
                  }

                  const newTocPage = createPage(
                    tocHeader,
                    pageContent,
                    tocFooter,
                    splitIndex === 0,
                    "toc",
                  );

                  // CRITICAL: Verify navigation after page creation
                  const pageMain = newTocPage.querySelector("main");
                  if (pageMain) {
                    const navs = pageMain.querySelectorAll(
                      ".document-navigation",
                    );
                    log(
                      `[Pagination]   After createPage: Found ${navs.length} navigation elements in main`,
                    );
                    navs.forEach((nav, navIdx) => {
                      const navItems =
                        nav.querySelectorAll(":scope > li");
                      log(
                        `[Pagination]     Nav ${navIdx + 1}: ${
                          navItems.length
                        } direct <li> children`,
                      );
                    });
                  }

                  // Insert after cover or at the beginning
                  if (insertAfter && insertAfter.nextSibling) {
                    body.insertBefore(
                      newTocPage,
                      insertAfter.nextSibling,
                    );
                  } else {
                    body.appendChild(newTocPage);
                  }
                  insertAfter = newTocPage;
                  createdTocPages.push(newTocPage);

                  log(
                    `[Pagination] Created ToC page ${splitIndex + 1}/${
                      tocContentPages.length
                    }`,
                  );
                });

                // Now set counter-reset for continuation pages to continue numbering
                let accumulatedNavItemsCount = 0;
                createdTocPages.forEach((tocPage, pageIndex) => {
                  if (pageIndex > 0) {
                    // Set counter-reset for current page using accumulated count
                    const pageMain = tocPage.querySelector("main");
                    if (pageMain) {
                      const nav = pageMain.querySelector(
                        ".document-navigation",
                      );
                      if (nav) {
                        nav.style.counterReset = `nav-counter ${accumulatedNavItemsCount}`;
                        log(
                          `[Pagination] ToC page ${
                            pageIndex + 1
                          }: counter reset to ${accumulatedNavItemsCount} (continuing from previous pages)`,
                        );
                      }
                    }
                  }

                  // Count numbered items on current page and add to accumulated count
                  const pageMain = tocPage.querySelector("main");
                  if (pageMain) {
                    const nav = pageMain.querySelector(
                      ".document-navigation",
                    );
                    if (nav) {
                      const numberedItems = nav.querySelectorAll(
                        ":scope > li:not(.nav-no-number)",
                      );
                      accumulatedNavItemsCount += numberedItems.length;
                    }
                  }
                });

                // IMPORTANT: After splitting ToC, navigation is already distributed across pages
                // No need to rebuild - it was already built and reordered before splitting
                log(
                  `[Pagination] ToC split complete. Navigation distributed across ${tocContentPages.length} pages.`,
                );
              } else {
                // ToC doesn't overflow, but we need to ensure it's positioned after Description
                // Find the last Description page
                const allDescriptionPages = Array.from(
                  document.querySelectorAll(
                    'section.page[id="description"], section.page[data-section-id="description"]',
                  ),
                );
                if (allDescriptionPages.length > 0) {
                  const lastDescriptionPage =
                    allDescriptionPages[allDescriptionPages.length - 1];
                  // Check if ToC is already after Description
                  const tocPageIndex = Array.from(body.children).indexOf(
                    tocPage,
                  );
                  const lastDescPageIndex = Array.from(
                    body.children,
                  ).indexOf(lastDescriptionPage);
                  if (tocPageIndex < lastDescPageIndex) {
                    // ToC is before Description, move it after
                    log(
                      `[Pagination] Moving ToC page after Description page`,
                    );
                    if (lastDescriptionPage.nextSibling) {
                      body.insertBefore(
                        tocPage,
                        lastDescriptionPage.nextSibling,
                      );
                    } else {
                      body.appendChild(tocPage);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Update page numbers in footers
      renumberPages();

      // CRITICAL: Navigation was already reordered before ToC splitting
      // Do NOT reorder again here to avoid duplication
      // reorderNavigationByContentOrder(); // MOVED BEFORE ToC SPLITTING

      // Update navigation page references
      updateNavigationPageNumbers();

      // Update company name in all footers (including dynamically created pages)
      if (window.setCompanyName) {
        window.setCompanyName();
      }

      // Update document title in all footers (including dynamically created pages)
      if (window.setDocumentTitle) {
        window.setDocumentTitle();
      }

      // Mark as paginated
      document.body.classList.add("auto-paginated");

      const duration = Math.round(performance.now() - startTime);
      log("[Pagination] ============================================");
      log(`[Pagination] PAGINATION COMPLETE in ${duration}ms`);
      log(`[Pagination] Final page count: ${newPages.length}`);
      log("[Pagination] ============================================");
      return true;
    } catch (error) {
      warn("[Pagination] Critical error during pagination:", error);
      // Try to restore document state if possible
      try {
        document.body.classList.remove("auto-paginated");
      } catch (restoreError) {
        warn(
          "[Pagination] Failed to restore document state:",
          restoreError,
        );
      }
      return false;
    }
  }

  // ================================================
  // REPAGINATION (for dynamic content)
  // ================================================

  /**
   * Re-run pagination (useful if content changes dynamically)
   * Note: In production, this should restore original DOM structure first
   */
  function repaginateDocument() {
    log("[Pagination] Repaginating document...");
    document.body.classList.remove("auto-paginated");
    paginateDocument();
  }

  // ================================================
  // INITIALIZATION
  // ================================================

  // Run pagination when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", paginateDocument);
  } else {
    // DOM already loaded, run immediately
    paginateDocument();
  }

  // Ensure pagination runs before printing
  window.addEventListener("beforeprint", function () {
    if (!document.body.classList.contains("auto-paginated")) {
      log("[Pagination] Emergency pagination before print");
      paginateDocument();
    }
  });

  // Expose public API for manual control
  window.SvemyPagination = {
    paginate: paginateDocument,
    repaginate: repaginateDocument,
    renumber: renumberPages,
    buildToc: buildTableOfContents,
    reorderNavigation: reorderNavigationByContentOrder,
    updateNavigation: updateNavigationPageNumbers,
    config: CONFIG,
  };

  log("[Pagination] Script loaded and ready");
})();

// ================================================
// FOOTER AUTO-FILL UTILITIES
// ================================================
(function () {
  "use strict";

  // Use global debug functions
  const log = window.SVEMY_LOG || (() => {});
  const warn = window.SVEMY_WARN || (() => {});

  // DOM element cache to avoid repeated queries
  const DOMCache = {
    _coverMetaCompany: null,
    _coverTitle: null,
    _brandTitles: null,
    _documentTitles: null,

    /**
     * Get cover meta company element (cached)
     * @returns {HTMLElement|null} Company element or null
     */
    getCoverMetaCompany() {
      return (
        this._coverMetaCompany ||
        (this._coverMetaCompany = document.querySelector(
          ".cover-meta-company",
        ))
      );
    },

    /**
     * Get cover title element (cached)
     * @returns {HTMLElement|null} Title element or null
     */
    getCoverTitle() {
      return (
        this._coverTitle ||
        (this._coverTitle = document.querySelector(".cover-title"))
      );
    },

    /**
     * Get all brand title elements (cached, refreshed on demand)
     * @param {boolean} refresh - Force refresh cache
     * @returns {NodeList} Brand title elements
     */
    getBrandTitles(refresh = false) {
      if (refresh || !this._brandTitles) {
        this._brandTitles = document.querySelectorAll(
          ".page-footer .brand-title",
        );
      }
      return this._brandTitles;
    },

    /**
     * Get all document title elements (cached, refreshed on demand)
     * @param {boolean} refresh - Force refresh cache
     * @returns {NodeList} Document title elements
     */
    getDocumentTitles(refresh = false) {
      if (refresh || !this._documentTitles) {
        this._documentTitles = document.querySelectorAll(
          ".page-footer .document-title",
        );
      }
      return this._documentTitles;
    },

    /**
     * Clear all caches (useful after DOM changes)
     */
    clearCache() {
      this._coverMetaCompany = null;
      this._coverTitle = null;
      this._brandTitles = null;
      this._documentTitles = null;
    },
  };

  /**
   * Clean text from copyright symbols and extra whitespace
   * @param {string} text - Text to clean
   * @returns {string} Cleaned text
   */
  function cleanText(text) {
    if (typeof text !== "string") return "";
    return text
      .replace(/^&copy;\s*/i, "") // Remove "&copy; "
      .replace(/^©\s*/g, "") // Remove "© "
      .replace(/^\(c\)\s*/i, "") // Remove "(c) "
      .replace(/^\u00A9\s*/g, "") // Remove Unicode copyright "© "
      .trim();
  }

  /**
   * Universal function to update footer fields
   * @param {Object} options - Configuration options
   * @param {string} options.sourceSelector - CSS selector for source element
   * @param {string} options.targetSelector - CSS selector for target elements
   * @param {Function} [options.transform] - Optional transform function for text
   * @param {string} options.logPrefix - Prefix for log messages
   * @param {string} options.fieldName - Name of field for error messages
   * @returns {boolean} True if update was successful
   */
  function updateFooterField(options) {
    try {
      const {
        sourceSelector,
        targetSelector,
        transform = cleanText,
        logPrefix,
        fieldName,
      } = options;

      // Get source element
      const sourceElement = document.querySelector(sourceSelector);
      if (!sourceElement) {
        warn(
          `[${logPrefix}] Source element "${sourceSelector}" not found`,
        );
        return false;
      }

      // Get and transform text
      let text = sourceElement.textContent;
      if (typeof transform === "function") {
        text = transform(text);
      }

      if (!text) {
        warn(`[${logPrefix}] ${fieldName} is empty after processing`);
        return false;
      }

      // Get target elements (use cache if available)
      let targetElements;
      if (targetSelector === ".page-footer .brand-title") {
        targetElements = DOMCache.getBrandTitles();
      } else if (targetSelector === ".page-footer .document-title") {
        targetElements = DOMCache.getDocumentTitles();
      } else {
        targetElements = document.querySelectorAll(targetSelector);
      }

      // Update all target elements
      let updateCount = 0;
      targetElements.forEach((element) => {
        try {
          element.textContent = text;
          updateCount++;
        } catch (error) {
          warn(`[${logPrefix}] Error updating element:`, error);
        }
      });

      log(
        `[${logPrefix}] Updated ${updateCount} ${fieldName} elements with: "${text}"`,
      );

      return updateCount > 0;
    } catch (error) {
      warn(`[${logPrefix}] Error in updateFooterField:`, error);
      return false;
    }
  }

  /**
   * Set company name in all footers
   * @returns {boolean} True if update was successful
   */
  function setCompanyName() {
    return updateFooterField({
      sourceSelector: ".cover-meta-company",
      targetSelector: ".page-footer .brand-title",
      transform: cleanText,
      logPrefix: "Company",
      fieldName: "brand title",
    });
  }

  /**
   * Set document title in all footers
   * @returns {boolean} True if update was successful
   */
  function setDocumentTitle() {
    return updateFooterField({
      sourceSelector: ".cover-title",
      targetSelector:
        ".page-footer .document-title:not([data-footer-doc-title-fixed])",
      transform: (text) => text.trim(), // Simple trim for document title
      logPrefix: "Document Title",
      fieldName: "document title",
    });
  }

  /**
   * Initialize footer fields on page load
   */
  function initializeFooters() {
    try {
      setCompanyName();
      setDocumentTitle();
    } catch (error) {
      warn("[Footer Init] Error initializing footers:", error);
    }
  }

  // Expose functions globally for use after pagination
  window.setCompanyName = setCompanyName;
  window.setDocumentTitle = setDocumentTitle;
  window.SvemyDOMCache = DOMCache; // Expose cache for advanced usage

  // Initialize on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeFooters);
  } else {
    initializeFooters();
  }
})();
