document.addEventListener('DOMContentLoaded', () => {
    const loadingArea = document.getElementById('loading-area');
    const fileInput = document.getElementById('file-input');
    const urlInput = document.getElementById('url-input');
    const loadUrlButton = document.getElementById('load-url');
    const loadingStatus = document.getElementById('loading-status');
    const bookContainer = document.getElementById('book-container');
    const pageLeft = document.getElementById('page-left');
    const pageRight = document.getElementById('page-right');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfoSpan = document.getElementById('page-info');
    const menuToggle = document.getElementById('menu-toggle');
    const sideMenu = document.getElementById('side-menu');
    const closeMenuButton = document.getElementById('close-menu');
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const overlay = document.getElementById('overlay');

    let bookContent = []; // Array to hold content sections (paragraphs, headings, etc.)
    let pages = []; // Array to hold content structured into pages
    let currentPage = 0; // Current page index (0-based)

    // --- Theme Management ---
    function setTheme(theme) {
        const body = document.body;
        body.classList.remove('light-theme', 'dark-theme', 'system-theme');

        if (theme === 'system') {
            body.classList.add('system-theme');
            // System theme is handled by CSS media query
        } else {
            body.classList.add(`${theme}-theme`);
        }
        // Save preference (optional)
        localStorage.setItem('theme', theme);
    }

    function applySavedTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

        if (savedTheme) {
            const radio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
            if (radio) {
                radio.checked = true;
                setTheme(savedTheme);
            } else {
                 // Fallback if saved theme value is invalid
                 document.querySelector('input[name="theme"][value="system"]').checked = true;
                 setTheme('system');
            }
        } else {
            // Default to system theme if no saved preference
             document.querySelector('input[name="theme"][value="system"]').checked = true;
             setTheme('system');
        }
    }


    // --- Markdown Parsing ---
    function parseMarkdown(markdownText) {
        const lines = markdownText.split('\n');
        const parsedContent = [];
        let currentBlock = '';

        function addBlock() {
            if (currentBlock.trim() !== '') {
                // Check for the *number* pattern at the beginning of a paragraph block
                const sectionMatch = currentBlock.match(/^\*(\d+)\*\s*/);
                if (sectionMatch) {
                    parsedContent.push(`<span class="section-number">${sectionMatch[0]}</span>` + currentBlock.substring(sectionMatch[0].length).trim());
                } else {
                    parsedContent.push(currentBlock.trim());
                }
                currentBlock = '';
            }
        }

        for (const line of lines) {
            if (line.trim() === '') {
                // Blank line, ends a paragraph block
                addBlock();
            } else if (line.startsWith('#')) {
                // Heading
                addBlock(); // Add any preceding paragraph block
                const level = line.match(/^#+/)[0].length;
                parsedContent.push(`<h${level}>${line.replace(/^#+\s*/, '')}</h${level}>`); // Add the heading line as HTML
            } else if (line.startsWith('-------')) {
                 // Horizontal Rule
                 addBlock(); // Add any preceding block
                 parsedContent.push('<hr>'); // Add the HR as HTML
            } else if (line.startsWith('_') && line.endsWith('_') && line.trim().split(' ').length > 1) {
                 // Basic Italics for a whole line (simple approach)
                 addBlock(); // Add any preceding block
                 parsedContent.push(`<em>${line.substring(1, line.length - 1)}</em>`); // Add the italic line as HTML
            }
             else {
                // Paragraph text
                if (currentBlock !== '') {
                    currentBlock += ' '; // Add space between lines in the same block
                }
                currentBlock += line;
            }
        }
        addBlock(); // Add the last block

        console.log("Parsed Content:", parsedContent); // Log parsed content for debugging
        return parsedContent;
    }

    // --- Pagination ---
    function paginateContent(content) {
         // Check if content is empty
         if (!content || content.length === 0) {
             return [];
         }

        const bookPages = [];
        let currentPageContent = [];
        let currentPageHeight = 0;

        // Get current page dimensions (dynamic based on window size)
        const isDesktop = window.innerWidth >= 768;
        const navigationHeight = document.getElementById('navigation').offsetHeight;
        const availableHeight = window.innerHeight - navigationHeight - 40; // Viewport height - nav height - some margin
        const pageHeight = availableHeight / (isDesktop ? 1 : 1); // On desktop, we still calculate based on single page height for simpler logic, the layout handles two pages.
        const pageWidth = (window.innerWidth / (isDesktop ? 2 : 1)) - 80; // Viewport width / pages per view - some margin

        // Helper to estimate element height
        function estimateHeight(elementHTML) {
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.visibility = 'hidden';
            tempDiv.style.width = pageWidth + 'px'; // Constrain width to page width
             // Apply relevant text styles for accurate measurement
            tempDiv.style.fontSize = '1rem';
            tempDiv.style.lineHeight = '1.6';
            tempDiv.style.fontFamily = 'serif';
            tempDiv.style.padding = '0';
            tempDiv.style.margin = '0'; // Reset default margins
            // Include estimated margins for block elements
             if (elementHTML.startsWith('<h')) tempDiv.style.marginTop = tempDiv.style.marginBottom = '0.5em';
             if (elementHTML === '<hr>') tempDiv.style.marginTop = tempDiv.style.marginBottom = '20px';
             if (elementHTML.startsWith('<p>')) tempDiv.style.marginBottom = '1.6em'; // Estimate paragraph spacing
             if (elementHTML.startsWith('<span class="section-number">')) tempDiv.style.marginTop = tempDiv.style.marginBottom = '1em';


            tempDiv.innerHTML = elementHTML;
            document.body.appendChild(tempDiv);
            const height = tempDiv.getBoundingClientRect().height; // Use getBoundingClientRect for more accurate height including potential margins
            document.body.removeChild(tempDiv);
            return height;
        }

        for (const block of content) {
            const blockHeight = estimateHeight(block); // Use the already generated HTML string

            if (currentPageHeight + blockHeight > pageHeight && currentPageContent.length > 0) {
                // Start a new page
                bookPages.push(currentPageContent);
                currentPageContent = [block]; // Add the block to the new page
                currentPageHeight = blockHeight;
            } else {
                // Add to current page
                currentPageContent.push(block);
                currentPageHeight += blockHeight;
            }
        }

        // Add the last page
        if (currentPageContent.length > 0) {
            bookPages.push(currentPageContent);
        }

        console.log("Paginated Pages:", bookPages); // Log pages for debugging
        return bookPages;
    }


    // --- Render Pages ---
    function renderPage(pageIndex) {
        const isDesktop = window.innerWidth >= 768;
        const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length; // Calculate total viewable units

        pageLeft.innerHTML = '';
        pageRight.innerHTML = '';

        if (isDesktop) {
            // Desktop view: Display two pages
            const leftPageIndex = pageIndex * 2;
            const rightPageIndex = pageIndex * 2 + 1;

            if (pages[leftPageIndex]) {
                pageLeft.innerHTML = pages[leftPageIndex].join('');
            } else {
                 pageLeft.innerHTML = ''; // Blank page if no content
            }
            if (pages[rightPageIndex]) {
                pageRight.innerHTML = pages[rightPageIndex].join('');
            } else {
                 pageRight.innerHTML = ''; // Blank page if no content
            }

            // Adjust page info for 2-page view
            const displayPageStart = leftPageIndex + 1;
            const displayPageEnd = Math.min(rightPageIndex + 1, pages.length); // Don't exceed total pages
            pageInfoSpan.textContent = `Pages ${displayPageStart}-${displayPageEnd} of ${pages.length}`;


             // Hide navigation buttons on the first and last page set
             prevButton.disabled = pageIndex === 0;
             nextButton.disabled = pageIndex >= totalPageSets - 1;


        } else {
            // Mobile view: Display one page
            const content = pages[pageIndex];
            if (content) {
                pageLeft.innerHTML = content.join('');
            } else {
                 pageLeft.innerHTML = ''; // Blank page if no content
            }
             pageRight.innerHTML = ''; // Ensure right page is empty on mobile
             pageInfoSpan.textContent = `Page ${pageIndex + 1} of ${pages.length}`; // Adjust page info for 1-page view
             // Hide navigation buttons on the first and last page
             prevButton.disabled = pageIndex === 0;
             nextButton.disabled = pageIndex >= pages.length - 1;
        }

        // Scroll pages to top when rendering new content (important if content overflowed)
        pageLeft.scrollTop = 0;
        pageRight.scrollTop = 0;


    }

     // --- Navigation ---
     function nextPage() {
        const isDesktop = window.innerWidth >= 768;
        const pagesPerView = isDesktop ? 2 : 1;
        const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;

        if (isDesktop) {
             if (currentPage < totalPageSets - 1) {
                 currentPage++;
                 renderPage(currentPage);
             }

        } else {
            if (currentPage < pages.length - 1) {
                currentPage++;
                renderPage(currentPage);
            }
        }
    }

    function prevPage() {
        if (currentPage > 0) {
            currentPage--;
            renderPage(currentPage);
        }
    }

    // Handle keyboard navigation (left/right arrows for page, up/down for section?)
    document.addEventListener('keydown', (event) => {
        if (bookContent.length > 0 && sideMenu.classList.contains('hidden')) { // Only navigate if book loaded and menu closed
            if (event.key === 'ArrowRight') {
                nextPage();
            } else if (event.key === 'ArrowLeft') {
                prevPage();
            }
            // Up/down arrow navigation (more complex to implement "section" navigation without a clear structure)
            // For now, let's just keep left/right for page navigation
        }
    });


    // --- Load Content and Initialize ---
    function loadContent(markdownText) {
        loadingStatus.textContent = 'Parsing content...';
        bookContent = parseMarkdown(markdownText);

        loadingStatus.textContent = 'Paginating content...';
        // Recalculate pagination whenever content is loaded
        pages = paginateContent(bookContent);

        if (pages.length > 0) {
            currentPage = 0; // Reset to first page
            renderPage(currentPage);
            loadingArea.style.display = 'none';
            bookContainer.style.display = 'flex'; // Show book container
            document.getElementById('navigation').style.display = 'flex'; // Show navigation
             menuToggle.style.display = 'block'; // Show menu toggle
            document.body.classList.add('book-loaded'); // Add class to body
            loadingStatus.textContent = ''; // Clear status
        } else {
            loadingStatus.textContent = 'Could not process book content or book is empty.';
            pageInfoSpan.textContent = "Page 0 of 0";
            prevButton.disabled = true;
            nextButton.disabled = true;
             loadingArea.style.display = 'block'; // Keep loading area visible
             bookContainer.style.display = 'none';
             document.getElementById('navigation').style.display = 'none';
             menuToggle.style.display = 'none'; // Hide menu toggle
             document.body.classList.remove('book-loaded'); // Remove class from body
        }
    }

    // --- Event Listeners for Loading ---
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            loadingStatus.textContent = `Loading file: ${file.name}...`;
            const reader = new FileReader();
            reader.onload = (e) => {
                loadContent(e.target.result);
            };
            reader.onerror = (e) => {
                loadingStatus.textContent = `Error loading file: ${e.target.error}`;
            };
            reader.readAsText(file);
        }
    });

    loadUrlButton.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (url) {
            loadingStatus.textContent = `Loading from URL: ${url}...`;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const markdownText = await response.text();
                loadContent(markdownText);
            } catch (error) {
                console.error("Error fetching markdown from URL:", error);
                loadingStatus.textContent = `Error loading URL: ${error.message}`;
            }
        } else {
            loadingStatus.textContent = 'Please enter a URL.';
        }
    });

    // --- Menu Toggling ---
    menuToggle.addEventListener('click', () => {
        sideMenu.classList.remove('hidden');
        overlay.classList.remove('hidden');
    });

    closeMenuButton.addEventListener('click', () => {
        sideMenu.classList.add('hidden');
        overlay.classList.add('hidden');
    });

    overlay.addEventListener('click', () => {
        sideMenu.classList.add('hidden');
        overlay.classList.add('hidden');
    });

    // --- Theme Selection ---
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            setTheme(event.target.value);
        });
    });


    // Event listeners for navigation buttons
    prevButton.addEventListener('click', prevPage);
    nextButton.addEventListener('click', nextPage);

     // Re-paginate and re-render on window resize
    window.addEventListener('resize', () => {
        if (bookContent.length > 0) { // Only re-paginate if content is loaded
            // Re-calculate pages with new dimensions
            pages = paginateContent(bookContent);

            // Adjust current page index if necessary after resize pagination
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
             // Ensure currentPage is within the new bounds
            if (currentPage >= totalPageSets) {
                currentPage = totalPageSets > 0 ? totalPageSets - 1 : 0;
            }

            renderPage(currentPage); // Re-render the current (adjusted) page
        }
    });

    // Apply saved theme preference on initial load
    applySavedTheme();

    // Initial state (nothing loaded yet)
     loadingStatus.textContent = 'Ready to load.';
     bookContainer.style.display = 'none';
     document.getElementById('navigation').style.display = 'none';
     menuToggle.style.display = 'none'; // Hide menu toggle until book is loaded
     sideMenu.classList.add('hidden'); // Ensure menu is hidden initially
     overlay.classList.add('hidden'); // Ensure overlay is hidden initially


});