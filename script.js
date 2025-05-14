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

    let bookContent = []; // Array to hold content sections (paragraphs, headings, etc.)
    let pages = []; // Array to hold content structured into pages
    let currentPage = 0; // Current page index (0-based)

    // --- Markdown Parsing ---
    function parseMarkdown(markdownText) {
        const lines = markdownText.split('\n');
        const parsedContent = [];
        let currentBlock = '';

        function addBlock() {
            if (currentBlock.trim() !== '') {
                parsedContent.push(currentBlock.trim());
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
                parsedContent.push(line); // Add the heading line
            } else if (line.startsWith('-------')) {
                 // Horizontal Rule
                 addBlock(); // Add any preceding block
                 parsedContent.push('-------'); // Add the HR marker
            } else if (line.startsWith('_') && line.endsWith('_') && line.trim().split(' ').length > 1) {
                 // Basic Italics for a whole line (simple approach)
                 addBlock(); // Add any preceding block
                 parsedContent.push(line); // Add the italic line
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
        const bookPages = [];
        let currentPageContent = [];
        let currentPageHeight = 0;
        const padding = 40; // Page padding (top + bottom)

        // Get current page dimensions (dynamic based on window size)
        const isDesktop = window.innerWidth >= 768;
        const availableHeight = window.innerHeight - document.getElementById('navigation').offsetHeight - 40; // Viewport height - nav height - some margin
        const pageHeight = availableHeight / (isDesktop ? 2 : 1); // Divide by 2 for desktop two-page view
        const pageWidth = (window.innerWidth / (isDesktop ? 2 : 1)) - 80; // Viewport width / pages per view - some margin

        // Helper to estimate element height
        function estimateHeight(elementHTML) {
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.visibility = 'hidden';
            tempDiv.style.width = pageWidth + 'px'; // Constrain width to page width
            tempDiv.style.padding = '0';
            tempDiv.style.margin = '0';
            tempDiv.style.fontSize = '1rem'; // Base font size (should match CSS)
            tempDiv.style.lineHeight = '1.6'; // Base line height (should match CSS)
            tempDiv.innerHTML = elementHTML;
            document.body.appendChild(tempDiv);
            const height = tempDiv.clientHeight;
            document.body.removeChild(tempDiv);
            return height;
        }

        for (const block of content) {
            let blockHTML = '';
            if (block.startsWith('#')) {
                const level = block.match(/^#+/)[0].length;
                blockHTML = `<h${level}>${block.replace(/^#+\s*/, '')}</h${level}>`;
                 // Add some margin consideration for headings
                currentPageHeight += 30; // Estimate space for heading margins
            } else if (block === '-------') {
                blockHTML = '<hr>';
                 currentPageHeight += 20; // Estimate space for HR
            } else if (block.startsWith('_') && block.endsWith('_')) {
                 blockHTML = `<em>${block.substring(1, block.length - 1)}</em>`;
            }
            else {
                blockHTML = `<p>${block}</p>`;
            }

            const blockHeight = estimateHeight(blockHTML);


            if (currentPageHeight + blockHeight > pageHeight && currentPageContent.length > 0) {
                // Start a new page
                bookPages.push(currentPageContent);
                currentPageContent = [blockHTML];
                currentPageHeight = blockHeight;
            } else {
                // Add to current page
                currentPageContent.push(blockHTML);
                currentPageHeight += blockHeight;
            }
        }

        // Add the last page
        if (currentPageContent.length > 0) {
            bookPages.push(currentPageContent);
        }

        console.log("Paginated Pages:", pages); // Log pages for debugging
        return bookPages;
    }


    // --- Render Pages ---
    function renderPage(pageIndex) {
        const isDesktop = window.innerWidth >= 768;

        pageLeft.innerHTML = '';
        pageRight.innerHTML = '';

        if (isDesktop) {
            // Desktop view: Display two pages
            const leftPageIndex = pageIndex * 2;
            const rightPageIndex = pageIndex * 2 + 1;

            if (pages[leftPageIndex]) {
                pageLeft.innerHTML = pages[leftPageIndex].join('');
            } else {
                 pageLeft.innerHTML = '<p>End of book</p>'; // Indicate end of book on left page if no more content
            }
            if (pages[rightPageIndex]) {
                pageRight.innerHTML = pages[rightPageIndex].join('');
            } else {
                 pageRight.innerHTML = '<p>End of book</p>'; // Indicate end of book on right page if no more content
            }

            // Adjust page info for 2-page view
            let totalDisplayPages = pages.length;
             if (totalDisplayPages % 2 !== 0) {
                 totalDisplayPages++; // Account for a potential half-filled last pair
             }
            pageInfoSpan.textContent = `Pages ${leftPageIndex + 1}-${rightPageIndex + 1} of ${pages.length}`;

             // Hide navigation buttons on the first and last page set
             prevButton.disabled = pageIndex === 0;
             nextButton.disabled = (pageIndex * 2 + 2) >= pages.length; // Disable if the *next* left page index is out of bounds


        } else {
            // Mobile view: Display one page
            const content = pages[pageIndex];
            if (content) {
                pageLeft.innerHTML = content.join('');
            } else {
                 pageLeft.innerHTML = '<p>End of book</p>'; // Indicate end of book on mobile if no more content
            }
             pageRight.innerHTML = ''; // Ensure right page is empty on mobile
             pageInfoSpan.textContent = `Page ${pageIndex + 1} of ${pages.length}`; // Adjust page info for 1-page view
             // Hide navigation buttons on the first and last page
             prevButton.disabled = pageIndex === 0;
             nextButton.disabled = pageIndex === pages.length - 1;
        }


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


    // --- Load Content and Initialize ---
    function loadContent(markdownText) {
        loadingStatus.textContent = 'Parsing content...';
        bookContent = parseMarkdown(markdownText);

        loadingStatus.textContent = 'Paginating content...';
        pages = paginateContent(bookContent);

        if (pages.length > 0) {
            currentPage = 0; // Reset to first page
            renderPage(currentPage);
            loadingArea.style.display = 'none';
            bookContainer.style.display = 'flex'; // Show book container
            document.getElementById('navigation').style.display = 'flex'; // Show navigation
            document.body.classList.add('book-loaded'); // Add class to body
            loadingStatus.textContent = ''; // Clear status
        } else {
            loadingStatus.textContent = 'Could not process book content.';
            pageInfoSpan.textContent = "Page 0 of 0";
            prevButton.disabled = true;
            nextButton.disabled = true;
             loadingArea.style.display = 'block'; // Keep loading area visible
             bookContainer.style.display = 'none';
             document.getElementById('navigation').style.display = 'none';
             document.body.classList.remove('book-loaded'); // Remove class from body
        }
    }

    // --- Event Listeners for Loading ---
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            loadingStatus.textContent = `Loading file: ${file.name}`;
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
            loadingStatus.textContent = `Loading from URL: ${url}`;
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

    // Event listeners for navigation buttons
    prevButton.addEventListener('click', prevPage);
    nextButton.addEventListener('click', nextPage);

     // Re-paginate and re-render on window resize
    window.addEventListener('resize', () => {
        if (bookContent.length > 0) { // Only re-paginate if content is loaded
            pages = paginateContent(bookContent);
            // Adjust current page if necessary after resize pagination
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            if (currentPage >= totalPageSets) {
                currentPage = totalPageSets > 0 ? totalPageSets - 1 : 0;
            }
            renderPage(currentPage);
        }
    });

    // Initial state (nothing loaded yet)
     loadingStatus.textContent = 'Ready to load.';
     bookContainer.style.display = 'none';
     document.getElementById('navigation').style.display = 'none';


});