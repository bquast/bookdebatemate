document.addEventListener('DOMContentLoaded', () => {
    const loadingArea = document.getElementById('loading-area');
    const bookSearchInput = document.getElementById('book-search');
    const repositoryBooksList = document.getElementById('repository-books-list');
    const fileInput = document.getElementById('file-input');
    const urlInput = document.getElementById('url-input');
    const loadUrlButton = document.getElementById('load-url');
    const loadingStatus = document.getElementById('loading-status');
    const recentBooksList = document.getElementById('recent-books-list');
    const clearRecentBooksButton = document.getElementById('clear-recent-books');
    const savedBooksSection = document.getElementById('saved-books-section');
    const savedBooksList = document.getElementById('saved-books-list');
    const clearSavedBooksButton = document.getElementById('clear-saved-books');
    const bookContainer = document.getElementById('book-container');
    const pageLeft = document.getElementById('page-left');
    const pageRight = document.getElementById('page-right');
    const menuToggle = document.getElementById('menu-toggle');
    const sideMenu = document.getElementById('side-menu');
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const overlay = document.getElementById('overlay');
    const menuPageInfo = document.getElementById('menu-page-info');
    const progressSection = document.getElementById('progress-section');


    let bookContent = []; // Array to hold content sections (paragraphs, headings, etc.)
    let pages = []; // Array to hold content structured into pages
    let currentPage = 0; // Current page index (0-based)
    let allRepositoryBooks = []; // Store the full list from the JSON
    const localStorageBookPrefix = 'bookmark_book_'; // Prefix for explicitly saved books
    const localStorageRecentPrefix = 'bookmark_recent_'; // Prefix for recent repository books


    // --- Local Storage Management (for explicitly saved books) ---
    function saveBookToLocalStorage(title, markdownText) {
        try {
            const bookData = {
                title: title,
                markdown: markdownText,
                lastPage: currentPage // Save current page
            };
            // Use a specific prefix for explicitly saved books
            localStorage.setItem(localStorageBookPrefix + title, JSON.stringify(bookData));
            console.log(`Book "${title}" saved to local storage.`);
            listSavedBooks(); // Refresh the saved books list
        } catch (e) {
            console.error("Failed to save book to local storage:", e);
            // Handle potential storage full errors gracefully
            loadingStatus.textContent = "Warning: Could not save book to local storage.";
        }
    }

    function loadBookFromLocalStorage(title) {
        try {
            const item = localStorage.getItem(localStorageBookPrefix + title);
            if (item) {
                const bookData = JSON.parse(item);
                console.log(`Book "${title}" loaded from local storage.`);
                loadContent(bookData.markdown, bookData.lastPage); // Load content and last page
                // Add to recent list if not already there
                addRecentBook({ title: bookData.title, url: null }); // URL is null for locally saved
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
            // Filter by the prefix for explicitly saved books
            if (key.startsWith(localStorageBookPrefix)) {
                try {
                    const item = localStorage.getItem(key);
                    const bookData = JSON.parse(item);
                    if (bookData && bookData.title && bookData.markdown) {
                        books.push({ key: key, title: bookData.title });
                    } else {
                         console.warn(`Invalid saved book data in localStorage key: ${key}`);
                         // Optionally remove invalid data: localStorage.removeItem(key);
                    }
                } catch (e) {
                     console.error(`Error parsing saved book localStorage item for key: ${key}`, e);
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
                    // Extract original title from key by removing prefix
                    const originalTitle = book.key.replace(localStorageBookPrefix, '');
                    loadBookFromLocalStorage(originalTitle);
                });
                savedBooksList.appendChild(li);
            });
            clearSavedBooksButton.style.display = 'block';
            savedBooksSection.style.display = 'block'; // Show the section if there are saved books
        } else {
            savedBooksList.innerHTML = '<li>No locally saved books found.</li>';
            clearSavedBooksButton.style.display = 'none';
             savedBooksSection.style.display = 'none'; // Hide the section if no saved books
        }
    }

    function clearSavedBooks() {
        if (confirm('Are you sure you want to clear all locally saved books?')) {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key.startsWith(localStorageBookPrefix)) {
                    localStorage.removeItem(key);
                }
            }
            listSavedBooks(); // Refresh the list
            // If the currently loaded book was cleared, go back to loading screen
            if (!currentlyLoadedBookTitle || !localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle)) {
                 showLoadingArea();
            }
        }
    }

    // --- Recent Files Management (for repository books) ---
    function addRecentBook(book) {
        let recentBooks = getRecentBooks();
        // Check if the book is already in the recent list (by URL for repo books, or title for local)
        const isAlreadyRecent = recentBooks.some(recent =>
            (book.url && recent.url === book.url) || (!book.url && recent.title === book.title)
        );

        if (!isAlreadyRecent) {
            // Add the new book to the beginning of the list
            recentBooks.unshift({ title: book.title, url: book.url });
            // Keep the list at a reasonable size (e.g., the last 10-20 recent books)
            recentBooks = recentBooks.slice(0, 20);
            localStorage.setItem('recentBooks', JSON.stringify(recentBooks));
            listRecentBooks(); // Refresh the recent books list
        }
    }

    function getRecentBooks() {
        const recentBooksString = localStorage.getItem('recentBooks');
        return recentBooksString ? JSON.parse(recentBooksString) : [];
    }

    function listRecentBooks() {
        recentBooksList.innerHTML = ''; // Clear current list
        const recentBooks = getRecentBooks();

        if (recentBooks.length > 0) {
            recentBooks.forEach(book => {
                const li = document.createElement('li');
                li.textContent = book.title;
                li.dataset.url = book.url; // Store the URL (or null for local)
                li.dataset.title = book.title; // Store the title
                li.addEventListener('click', () => {
                    if (book.url) {
                         loadBookFromURL(book.url, book.title); // Load from URL for repo books
                    } else {
                         loadBookFromLocalStorage(book.title); // Load from local storage for saved files
                    }

                });
                recentBooksList.appendChild(li);
            });
            clearRecentBooksButton.style.display = 'block';
        } else {
            recentBooksList.innerHTML = '<li>No recent files.</li>';
            clearRecentBooksButton.style.display = 'none';
        }
    }

    function clearRecentBooks() {
        if (confirm('Are you sure you want to clear your recent files list?')) {
            localStorage.removeItem('recentBooks');
            listRecentBooks();
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
                 const trimmedBlock = currentBlock.trim();

                 // Check for block italics (whole line wrapped in single underscores)
                 // Use a regex to be more robust
                 const italicBlockMatch = trimmedBlock.match(/^\_([^_]+)\_$/);
                 if (italicBlockMatch && italicBlockMatch[1].trim().length > 0) {
                     parsedContent.push(`<em>${italicBlockMatch[1].trim()}</em>`);

                 // Check for the *number* pattern at the beginning of a paragraph block
                 } else {
                     const sectionMatch = trimmedBlock.match(/^\*(\d+)\*\s*/);
                     if (sectionMatch) {
                        // Render as just the number inside the span
                        parsedContent.push(`<span class="section-number">${sectionMatch[1]}</span>` + trimmedBlock.substring(sectionMatch[0].length).trim());
                     } else {
                         // Regular paragraph
                         parsedContent.push(trimmedBlock);
                     }
                 }

                currentBlock = '';
            }
        }

        for (const line of lines) {
            const trimmedLine = line.trim();


            if (trimmedLine === '') {
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
                // Paragraph text (can include lines for block italics before addBlock)
                if (currentBlock !== '') {
                    currentBlock += '\n'; // Keep newline within a block for proper italic detection later if needed
                }
                currentBlock += line;
            }
        }
        addBlock(); // Add the last block

        // After getting blocks, process paragraphs for potential inline italics (optional, but good practice)
        // This specific book format doesn't seem to use inline italics much,
        // but this would be the place to add a replace for _word_ or _multiple words_ within <p> tags.
        // For now, the block italic logic should handle the "Translated By Thomas Common" case.

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
        const pagePadding = 20; // Padding on the .page element
        const bookContainerPadding = 20; // Padding on the #book-container
        const availableHeight = window.innerHeight - (bookContainerPadding * 2); // Viewport height - total top/bottom padding on container
        const pageHeight = availableHeight; // Use full available height for pagination calculation
        const pageWidth = (window.innerWidth / (isDesktop ? 2 : 1)) - (pagePadding * 2); // Viewport width / pages per view - total left/right padding on page


        // Helper to estimate element height
        function estimateHeight(elementHTML) {
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.visibility = 'hidden';
            tempDiv.style.width = pageWidth + 'px'; // Constrain width to page width (content area width)
             // Apply relevant text styles for accurate measurement
            tempDiv.style.fontSize = '1rem'; // Base font size
            tempDiv.style.lineHeight = '1.6'; // Base line height
            tempDiv.style.fontFamily = 'serif'; // Font family
             // Ensure padding/margin is consistent with .page content styles (resetting defaults)
            tempDiv.style.padding = '0';
            tempDiv.style.margin = '0';

            // Apply specific CSS margins for height calculation
            if (elementHTML.startsWith('<h1')) {
                 tempDiv.style.marginTop = '2.5em';
                 tempDiv.style.marginBottom = '0.5em';
            } else if (elementHTML.startsWith('<h2') || elementHTML.startsWith('<h3')) {
                tempDiv.style.marginTop = '2.5em';
                tempDiv.style.marginBottom = '0.5em';
            } else if (elementHTML.startsWith('<span class="section-number">')) {
                 tempDiv.style.marginTop = '2.5em';
                 tempDiv.style.marginBottom = '1em';
            } else if (elementHTML.startsWith('<p>') || elementHTML.startsWith('<em>')) {
                 tempDiv.style.marginTop = '0';
                 tempDiv.style.marginBottom = '1em';
            } else if (elementHTML === '<hr>') {
                 tempDiv.style.marginTop = '1em';
                 tempDiv.style.marginBottom = '1em';
            }


            tempDiv.innerHTML = elementHTML;
            document.body.appendChild(tempDiv);
            const height = tempDiv.getBoundingClientRect().height; // Use getBoundingClientRect for more accurate height
            document.body.removeChild(tempDiv);

             // Add a small buffer per block to account for rounding or minor inconsistencies
             const blockBuffer = 1; // Adjust as needed
            return height + blockBuffer;
        }

        for (const block of content) {
            const blockHeight = estimateHeight(block); // Use the already generated HTML string

            // Check if adding the block exceeds current page height
            // Add a small tolerance to prevent very minor overflows
            const tolerance = 1; // Pixels
            if (currentPageHeight + blockHeight > pageHeight + tolerance && currentPageContent.length > 0) {
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

        // Save current page to local storage if a book is loaded (only for explicitly saved books)
        if (bookContent.length > 0 && currentlyLoadedBookTitle && localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle)) {
            try {
                 const item = localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle);
                 if (item) {
                     const bookData = JSON.parse(item);
                     bookData.lastPage = currentPage;
                     localStorage.setItem(localStorageBookPrefix + currentlyLoadedBookTitle, JSON.stringify(bookData));
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

    // Handle keyboard navigation (left/right arrows for page, space/enter for next)
    document.addEventListener('keydown', (event) => {
        // Check if a book is loaded and menu is closed
        if (bookContent.length > 0 && sideMenu.classList.contains('hidden')) {
            if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
                nextPage();
                event.preventDefault(); // Prevent default browser behavior (scrolling, button click)
            } else if (event.key === 'ArrowLeft') {
                prevPage();
                event.preventDefault(); // Prevent default browser scrolling
            }
        }
         // Allow Escape key to close menu regardless of book state
         if (event.key === 'Escape') {
             if (!sideMenu.classList.contains('hidden')) {
                 closeMenu();
             }
         }
    });

    // Handle mouse click navigation on pages
    pageLeft.addEventListener('click', () => {
         if (bookContent.length > 0 && sideMenu.classList.contains('hidden')) {
             prevPage();
         }
    });

    pageRight.addEventListener('click', () => {
         if (bookContent.length > 0 && sideMenu.classList.contains('hidden')) {
             nextPage();
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
        currentlyLoadedBookTitle = null; // Reset loaded book
        listSavedBooks(); // Refresh the saved books list
        listRecentBooks(); // Refresh the recent books list
    }

    // Load markdown content from a URL
    async function loadBookFromURL(url, title, initialPage = 0) {
         loadingStatus.textContent = `Loading from URL: ${url}...`;
         try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const markdownText = await response.text();
            loadContent(markdownText, initialPage, title); // Pass title to loadContent
             // Add to recent list after successful loading
            addRecentBook({ title: title, url: url });

         } catch (error) {
             console.error("Error fetching markdown from URL:", error);
             loadingStatus.textContent = `Error loading URL: ${error.message}`;
             showLoadingArea(); // Go back to loading area on failure
         }
    }


    // Load markdown content (internal processing)
    function loadContent(markdownText, initialPage = 0, title = 'Untitled Book') {
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
             // Set currently loaded book title (used for saving progress later)
             currentlyLoadedBookTitle = title;

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
                 // Use filename as title for local files
                const title = file.name.replace(/\.md$/, '');
                 // Optionally, ask user if they want to save to local storage permanently
                 // If yes, call saveBookToLocalStorage(title, e.target.result);
                 // Otherwise, just load it
                loadContent(e.target.result, 0, title); // Load content directly
                 addRecentBook({ title: title, url: null }); // Add to recent list

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
             // Attempt to extract a title from the URL or content after fetching
             // For now, use URL filename as a placeholder title before fetching
            const urlParts = url.split('/');
            const placeholderTitle = urlParts[urlParts.length - 1].replace(/\.md$/, '') || 'Untitled URL Book';
            loadBookFromURL(url, placeholderTitle); // Load from the URL

        } else {
            loadingStatus.textContent = 'Please enter a URL.';
        }
    });

    // --- Repository Book List and Search ---
    async function fetchRepositoryBooks() {
        try {
            // Assuming books_index.json is at the root of the deployed site
            const response = await fetch('books_index.json');
            if (!response.ok) {
                 // If the index is not found, hide the repository section
                 document.querySelector('.load-option h3').textContent = 'Repository books not available.';
                 bookSearchInput.style.display = 'none';
                 repositoryBooksList.style.display = 'none';
                 return;
            }
            allRepositoryBooks = await response.json();
            renderRepositoryBooks(allRepositoryBooks); // Render initial list
        } catch (error) {
            console.error("Error fetching repository book index:", error);
             document.querySelector('.load-option h3').textContent = 'Error loading repository books.';
             bookSearchInput.style.display = 'none';
             repositoryBooksList.style.display = 'none';
        }
    }

    function renderRepositoryBooks(booksToRender) {
        repositoryBooksList.innerHTML = ''; // Clear current list
        if (booksToRender.length > 0) {
            booksToRender.forEach(book => {
                const li = document.createElement('li');
                li.textContent = `${book.title} by ${book.author} (${book.year})`;
                li.dataset.url = book.url; // Store the URL
                li.dataset.title = book.title; // Store the title
                li.addEventListener('click', () => {
                    loadBookFromURL(book.url, book.title); // Load the book from its URL
                });
                repositoryBooksList.appendChild(li);
            });
        } else {
            repositoryBooksList.innerHTML = '<li>No books found matching your search.</li>';
        }
    }

    function filterRepositoryBooks() {
        const searchTerm = bookSearchInput.value.toLowerCase();
        const filteredBooks = allRepositoryBooks.filter(book => {
            return book.title.toLowerCase().includes(searchTerm) ||
                   book.author.toLowerCase().includes(searchTerm);
        });
        renderRepositoryBooks(filteredBooks);
    }


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
        listRecentBooks(); // List recent files on the loading page
        fetchRepositoryBooks(); // Fetch and display repository books

        // Initial state (show loading area)
         showLoadingArea();

         // Add event listeners
         clearSavedBooksButton.addEventListener('click', clearSavedBooks);
         clearRecentBooksButton.addEventListener('click', clearRecentBooks);
         bookSearchInput.addEventListener('input', filterRepositoryBooks); // Live filtering


    }

    init(); // Initialize the application

});