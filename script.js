document.addEventListener('DOMContentLoaded', () => {
    const loadingArea = document.getElementById('loading-area');
    const fileInput = document.getElementById('file-input');
    const urlInput = document.getElementById('url-input');
    const loadUrlButton = document.getElementById('load-url');
    const loadingStatus = document.getElementById('loading-status');
    const savedBooksList = document.getElementById('saved-books-list');
    const clearSavedBooksButton = document.getElementById('clear-saved-books');
    const bookContainer = document.getElementById('book-container');
    const pageLeft = document.getElementById('page-left');
    const pageRight = document.getElementById('page-right');
    const menuToggle = document.getElementById('menu-toggle');
    const sideMenu = document.getElementById('side-menu');
    // const closeMenuButton = document.getElementById('close-menu'); Removed
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const overlay = document.getElementById('overlay');
    const menuPageInfo = document.getElementById('menu-page-info');
    const progressSection = document.getElementById('progress-section');


    let bookContent = []; // Array to hold content sections (paragraphs, headings, etc.)
    let pages = []; // Array to hold content structured into pages
    let currentPage = 0; // Current page index (0-based)
    const localStorageKeyPrefix = 'bookmark_book_'; // Prefix for localStorage keys

    // --- Local Storage Management ---
    function saveBookToLocalStorage(title, markdownText) {
        try {
            const bookData = {
                title: title,
                markdown: markdownText,
                lastPage: currentPage // Save current page, not just 0
            };
            localStorage.setItem(localStorageKeyPrefix + title, JSON.stringify(bookData));
            console.log(`Book "${title}" saved to local storage.`);
            listSavedBooks(); // Refresh the list after saving
        } catch (e) {
            console.error("Failed to save book to local storage:", e);
            // Handle potential storage full errors gracefully
            loadingStatus.textContent = "Warning: Could not save book to local storage.";
        }
    }

    function loadBookFromLocalStorage(title) {
        try {
            const item = localStorage.getItem(localStorageKeyPrefix + title);
            if (item) {
                const bookData = JSON.parse(item);
                console.log(`Book "${title}" loaded from local storage.`);
                loadContent(bookData.markdown, bookData.lastPage); // Load content and last page
                return true;
            }
        } catch (e) {
            console.error(`Failed to load book "${title}" from local storage:`, e);
        }
        return false;
    }

    function listSavedBooks() {
        savedBooksList.innerHTML = ''; // Clear current list
        const books = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(localStorageKeyPrefix)) {
                try {
                    const item = localStorage.getItem(key);
                    const bookData = JSON.parse(item);
                    if (bookData && bookData.title && bookData.markdown) {
                        books.push({ key: key, title: bookData.title });
                    } else {
                         console.warn(`Invalid book data in localStorage key: ${key}`);
                         // Optionally remove invalid data: localStorage.removeItem(key);
                    }
                } catch (e) {
                     console.error(`Error parsing localStorage item for key: ${key}`, e);
                      // Optionally remove corrupt data: localStorage.removeItem(key);
                }
            }
        }

        if (books.length > 0) {
            books.forEach(book => {
                const li = document.createElement('li');
                li.textContent = book.title;
                li.dataset.key = book.key; // Store the key
                li.addEventListener('click', () => {
                    loadBookFromLocalStorage(book.title);
                });
                savedBooksList.appendChild(li);
            });
            clearSavedBooksButton.style.display = 'block';
        } else {
            savedBooksList.innerHTML = '<li>No saved books found.</li>';
            clearSavedBooksButton.style.display = 'none';
        }
    }

    function clearSavedBooks() {
        if (confirm('Are you sure you want to clear all saved books?')) {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key.startsWith(localStorageKeyPrefix)) {
                    localStorage.removeItem(key);
                }
            }
            listSavedBooks(); // Refresh the list
            // If the currently loaded book was cleared, go back to loading screen
            if (!currentlyLoadedBookTitle || !localStorage.getItem(localStorageKeyPrefix + currentlyLoadedBookTitle)) {
                 showLoadingArea();
            }
        }
    }


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
        // Save preference
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
                    // Render as just the number inside the span
                    parsedContent.push(`<span class="section-number">${sectionMatch[1]}</span>` + currentBlock.substring(sectionMatch[0].length).trim());
                } else {
                    parsedContent.push(currentBlock.trim());
                }
                currentBlock = '';
            }
        }

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check for the _Translated By Thomas Common_ pattern (simple full line italic)
             // Ensure it's not just an underscore and is the entire trimmed line
            if (trimmedLine.startsWith('_') && trimmedLine.endsWith('_') && trimmedLine.length > 1 && trimmedLine.indexOf(' ') === -1) {
                 addBlock(); // Add any preceding block
                 parsedContent.push(`<em>${trimmedLine.substring(1, trimmedLine.length - 1)}</em>`);

            } else if (trimmedLine === '') {
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
        // No navigation bar height to subtract anymore
        const availableHeight = window.innerHeight - 40; // Viewport height - some margin
        const pageHeight = availableHeight; // Use full height for pagination calculation
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
             // Check if it's a paragraph or section number or italic to apply bottom margin
             if (elementHTML.startsWith('<p>') || elementHTML.startsWith('<span class="section-number">') || elementHTML.startsWith('<em>')) tempDiv.style.marginBottom = '1.6em'; // Estimate paragraph/block spacing


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

        // Update page progress in the menu
        if (pages.length > 0) {
             const displayPageStart = isDesktop ? (pageIndex * 2) + 1 : pageIndex + 1;
             const displayPageEnd = isDesktop ? Math.min((pageIndex * 2) + 2, pages.length) : pageIndex + 1;
            menuPageInfo.textContent = `Page ${displayPageStart}${isDesktop && displayPageEnd > displayPageStart ? '-' + displayPageEnd : ''} of ${pages.length}`;
             progressSection.style.display = 'block'; // Show progress section
        } else {
             menuPageInfo.textContent = "Page 0 of 0";
             progressSection.style.display = 'none'; // Hide progress section
        }


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


        } else {
            // Mobile view: Display one page
            const content = pages[pageIndex];
            if (content) {
                pageLeft.innerHTML = content.join('');
            } else {
                 pageLeft.innerHTML = ''; // Blank page if no content
            }
             pageRight.innerHTML = ''; // Ensure right page is empty on mobile
        }

        // Scroll pages to top when rendering new content (important if content overflowed)
        pageLeft.scrollTop = 0;
        pageRight.scrollTop = 0;

        // Save current page to local storage if a book is loaded
        if (bookContent.length > 0 && currentlyLoadedBookTitle) {
            try {
                 const item = localStorage.getItem(localStorageKeyPrefix + currentlyLoadedBookTitle);
                 if (item) {
                     const bookData = JSON.parse(item);
                     bookData.lastPage = currentPage;
                     localStorage.setItem(localStorageKeyPrefix + currentlyLoadedBookTitle, JSON.stringify(bookData));
                 }
            } catch (e) {
                console.error("Failed to save current page to local storage:", e);
            }
        }
    }

     // --- Navigation ---
     function nextPage() {
        const isDesktop = window.innerWidth >= 768;
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

    // Handle keyboard navigation (left/right arrows for page)
    document.addEventListener('keydown', (event) => {
        // Check if a book is loaded and menu is closed
        if (bookContent.length > 0 && sideMenu.classList.contains('hidden')) {
            if (event.key === 'ArrowRight') {
                nextPage();
                event.preventDefault(); // Prevent default browser scrolling
            } else if (event.key === 'ArrowLeft') {
                prevPage();
                event.preventDefault(); // Prevent default browser scrolling
            }
        }
         // Allow Escape key to close menu
         if (event.key === 'Escape') {
             if (!sideMenu.classList.contains('hidden')) {
                 closeMenu();
             }
         }
    });


    // --- Load Content and Initialize ---
    let currentlyLoadedBookTitle = null; // To track the currently loaded book for saving progress

    // Function to show the loading area and hide book/menu
    function showLoadingArea() {
        loadingArea.style.display = 'block';
        bookContainer.style.display = 'none';
        menuToggle.style.display = 'none';
        sideMenu.classList.add('hidden'); // Ensure menu is closed
        overlay.classList.add('hidden'); // Ensure overlay is hidden
        document.body.classList.remove('book-loaded');
        currentlyLoadedBookTitle = null;
        listSavedBooks(); // Refresh the list in case something was cleared
    }

    function loadContent(markdownText, initialPage = 0) {
        loadingStatus.textContent = 'Parsing content...';
        bookContent = parseMarkdown(markdownText);

        loadingStatus.textContent = 'Paginating content...';
        // Recalculate pagination whenever content is loaded
        pages = paginateContent(bookContent);

        if (pages.length > 0) {
            // Attempt to set the initial page, but ensure it's within bounds
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(initialPage, totalPageSets > 0 ? totalPageSets - 1 : 0);

            renderPage(currentPage);
            loadingArea.style.display = 'none';
            bookContainer.style.display = 'flex'; // Show book container
            menuToggle.style.display = 'block'; // Show menu toggle
            document.body.classList.add('book-loaded'); // Add class to body
            loadingStatus.textContent = ''; // Clear status
             // Identify book title for saving progress
             const titleMatch = markdownText.match(/^#\s*(.+)/m);
             currentlyLoadedBookTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Book';

        } else {
            loadingStatus.textContent = 'Could not process book content or book is empty.';
            menuPageInfo.textContent = "Page 0 of 0"; // Update menu progress
            progressSection.style.display = 'none'; // Hide progress section
             showLoadingArea(); // Go back to loading area on failure
        }
         closeMenu(); // Close menu after loading content

    }

    // --- Event Listeners for Loading ---
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            loadingStatus.textContent = `Loading file: ${file.name}...`;
            const reader = new FileReader();
            reader.onload = (e) => {
                 // Save to local storage after loading from file
                saveBookToLocalStorage(file.name.replace(/\.md$/, ''), e.target.result);
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
                 // Attempt to extract a title from the URL or content
                 const urlParts = url.split('/');
                 const defaultTitle = urlParts[urlParts.length - 1].replace(/\.md$/, '') || 'Untitled URL Book';
                 const contentTitleMatch = markdownText.match(/^#\s*(.+)/m);
                 const bookTitle = contentTitleMatch ? contentTitleMatch[1].trim() : defaultTitle;

                 // Save to local storage after loading from URL
                saveBookToLocalStorage(bookTitle, markdownText);
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
    function openMenu() {
        sideMenu.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    function closeMenu() {
        sideMenu.classList.add('hidden');
        overlay.classList.add('hidden');
    }

    // Toggle menu: if hidden, open; if open, close
    menuToggle.addEventListener('click', () => {
        if (sideMenu.classList.contains('hidden')) {
            openMenu();
        } else {
            closeMenu();
        }
    });

    // closeMenuButton.addEventListener('click', closeMenu); Removed
    overlay.addEventListener('click', closeMenu);


    // --- Theme Selection ---
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            setTheme(event.target.value);
        });
    });


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

    // --- Initialization ---
    function init() {
        applySavedTheme(); // Apply saved theme preference
        listSavedBooks(); // List saved books on the loading page

        // Initial state (show loading area)
         showLoadingArea();

         // Add event listener for clearing saved books
         clearSavedBooksButton.addEventListener('click', clearSavedBooks);

    }

    init(); // Initialize the application

});