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

    const sideMenu = document.getElementById('side-menu');
    const menuToggle = document.getElementById('menu-toggle');
    const expandedMenuContent = document.getElementById('expanded-menu-content');
    const collapsedProgress = document.getElementById('collapsed-progress');
    const verticalPageInfo = document.getElementById('vertical-page-info');

    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const justifyTextCheckbox = document.getElementById('justify-text');
    const overlay = document.getElementById('overlay'); // Re-get overlay if needed, or ensure it's correctly handled

    const menuPageInfo = document.getElementById('menu-page-info'); // For expanded menu
    const progressSectionExpanded = document.getElementById('progress-section-expanded');


    let bookContent = [];
    let pages = [];
    let currentPage = 0;
    let allRepositoryBooks = [];
    const localStorageBookPrefix = 'bookmark_book_';
    const localStorageRecentPrefix = 'bookmark_recent_';


    // --- Local Storage Management (for explicitly saved books) ---
    function saveBookToLocalStorage(title, markdownText) {
        try {
            const bookData = {
                title: title,
                markdown: markdownText,
                lastPage: currentPage // Save current page
            };
            localStorage.setItem(localStorageBookPrefix + title, JSON.stringify(bookData));
            console.log(`Book "${title}" saved to local storage.`);
            listSavedBooks();
        } catch (e) {
            console.error("Failed to save book to local storage:", e);
            loadingStatus.textContent = "Warning: Could not save book to local storage.";
        }
    }

    function loadBookFromLocalStorage(title) {
        try {
            const item = localStorage.getItem(localStorageBookPrefix + title);
            if (item) {
                const bookData = JSON.parse(item);
                console.log(`Book "${title}" loaded from local storage.`);
                loadContent(bookData.markdown, bookData.lastPage, bookData.title); // Pass title
                addRecentBook({ title: bookData.title, url: null });
                return true;
            }
        } catch (e) {
            console.error(`Failed to load book "${title}" from local storage:`, e);
        }
        return false;
    }

    function listSavedBooks() {
        savedBooksList.innerHTML = '';
        const books = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(localStorageBookPrefix)) {
                try {
                    const item = localStorage.getItem(key);
                    const bookData = JSON.parse(item);
                    if (bookData && bookData.title && bookData.markdown) {
                        books.push({ key: key, title: bookData.title });
                    } else {
                         console.warn(`Invalid saved book data in localStorage key: ${key}`);
                    }
                } catch (e) {
                     console.error(`Error parsing saved book localStorage item for key: ${key}`, e);
                }
            }
        }

        if (books.length > 0) {
            books.forEach(book => {
                const li = document.createElement('li');
                li.textContent = book.title;
                li.dataset.key = book.key;
                li.addEventListener('click', () => {
                    const originalTitle = book.key.replace(localStorageBookPrefix, '');
                    loadBookFromLocalStorage(originalTitle);
                });
                savedBooksList.appendChild(li);
            });
            clearSavedBooksButton.style.display = 'block';
            savedBooksSection.style.display = 'block';
        } else {
            savedBooksList.innerHTML = '<li>No locally saved books found.</li>';
            clearSavedBooksButton.style.display = 'none';
             savedBooksSection.style.display = 'none';
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
            listSavedBooks();
            if (!currentlyLoadedBookTitle || !localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle)) {
                 showLoadingScreenInterface();
            }
        }
    }

    // --- Recent Files Management ---
    function addRecentBook(book) {
        let recentBooks = getRecentBooks();
        const isAlreadyRecent = recentBooks.some(recent =>
            (book.url && recent.url === book.url) || (!book.url && recent.title === book.title)
        );

        if (!isAlreadyRecent) {
            recentBooks.unshift({ title: book.title, url: book.url });
            recentBooks = recentBooks.slice(0, 20);
            localStorage.setItem('recentBooks', JSON.stringify(recentBooks));
            listRecentBooks();
        }
    }

    function getRecentBooks() {
        const recentBooksString = localStorage.getItem('recentBooks');
        return recentBooksString ? JSON.parse(recentBooksString) : [];
    }

    function listRecentBooks() {
        recentBooksList.innerHTML = '';
        const recentBooks = getRecentBooks();

        if (recentBooks.length > 0) {
            recentBooks.forEach(book => {
                const li = document.createElement('li');
                li.textContent = book.title;
                li.dataset.url = book.url;
                li.dataset.title = book.title;
                li.addEventListener('click', () => {
                    if (book.url) {
                         loadBookFromURL(book.url, book.title);
                    } else {
                         loadBookFromLocalStorage(book.title);
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
        } else {
            body.classList.add(`${theme}-theme`);
        }
        localStorage.setItem('theme', theme);
    }

    function applySavedTheme() {
        const savedTheme = localStorage.getItem('theme') || 'system'; // Default to system
        const radio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
        if (radio) {
            radio.checked = true;
        }
        setTheme(savedTheme);
    }

    // --- Text Justification ---
    function setJustifyText(justify) {
        if (justify) {
            bookContainer.classList.add('text-justify');
        } else {
            bookContainer.classList.remove('text-justify');
        }
        localStorage.setItem('justifyText', justify);
        if (bookContent.length > 0) { // Re-paginate if content is loaded as justification can change flow
            pages = paginateContent(bookContent);
            renderPage(currentPage);
        }
    }

    function applySavedJustification() {
        const savedJustify = localStorage.getItem('justifyText') === 'true';
        justifyTextCheckbox.checked = savedJustify;
        setJustifyText(savedJustify);
    }


    // --- Markdown Parsing ---
    function parseMarkdown(markdownText) {
        const lines = markdownText.split('\n');
        const parsedContent = [];
        let currentBlock = '';

        function addBlock() {
            if (currentBlock.trim() !== '') {
                 const trimmedBlock = currentBlock.trim();
                 const italicBlockMatch = trimmedBlock.match(/^\_([^_]+)\_$/);
                 if (italicBlockMatch && italicBlockMatch[1].trim().length > 0) {
                     parsedContent.push(`<em>${italicBlockMatch[1].trim()}</em>`);
                 } else {
                     const sectionMatch = trimmedBlock.match(/^\*(\d+)\*\s*/);
                     if (sectionMatch) {
                        parsedContent.push(`<span class="section-number">${sectionMatch[1]}</span>` + trimmedBlock.substring(sectionMatch[0].length).trim());
                     } else {
                         parsedContent.push(`<p>${trimmedBlock}</p>`); // Wrap paragraphs in <p>
                     }
                 }
                currentBlock = '';
            }
        }

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '') {
                addBlock();
            } else if (line.startsWith('#')) {
                addBlock();
                const level = line.match(/^#+/)[0].length;
                parsedContent.push(`<h${level}>${line.replace(/^#+\s*/, '')}</h${level}>`);
            } else if (line.startsWith('-------')) {
                 addBlock();
                 parsedContent.push('<hr>');
            } else {
                if (currentBlock !== '') {
                    currentBlock += '\n';
                }
                currentBlock += line;
            }
        }
        addBlock();
        console.log("Parsed Content:", parsedContent);
        return parsedContent;
    }

    // --- Pagination ---
    function paginateContent(content) {
         if (!content || content.length === 0) return [];
        const bookPages = [];
        let currentPageContent = [];
        let currentPageHeight = 0;

        const isDesktop = window.innerWidth >= 768;
        const pagePadding = 20;
        const bookContainerPadding = 20;
        // Consider sidebar width for available page width
        const currentSidebarWidth = sideMenu.classList.contains('expanded') && window.innerWidth >= 768 ?
                                    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width-expanded')) :
                                    (window.innerWidth >= 768 ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width-collapsed')) : 0);

        const availableWidthForBook = window.innerWidth - currentSidebarWidth;
        const availableHeight = window.innerHeight - (bookContainerPadding * 2);
        const pageHeight = availableHeight;
        const pageWidth = (availableWidthForBook / (isDesktop ? 2 : 1)) - (pagePadding * 2) - (isDesktop ? 10 : 0) ; // 10 for gap between pages


        function estimateHeight(elementHTML) {
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.visibility = 'hidden';
            tempDiv.style.width = pageWidth + 'px';
            tempDiv.style.fontSize = '1rem';
            tempDiv.style.lineHeight = '1.6';
            tempDiv.style.fontFamily = 'serif';
            tempDiv.style.padding = '0';
            tempDiv.style.margin = '0';

            // Apply specific CSS margins for height calculation
            if (elementHTML.startsWith('<h1')) {
                 tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '0.5em';
            } else if (elementHTML.startsWith('<h2') || elementHTML.startsWith('<h3')) {
                tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '0.5em';
            } else if (elementHTML.startsWith('<span class="section-number">')) {
                 tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '1em';
            } else if (elementHTML.startsWith('<p>') || elementHTML.startsWith('<em>')) {
                 tempDiv.style.marginTop = '0'; tempDiv.style.marginBottom = '1em';
            } else if (elementHTML === '<hr>') {
                 tempDiv.style.marginTop = '1em'; tempDiv.style.marginBottom = '1em';
            }
            // If text justification is active, apply it for height estimation
            if (justifyTextCheckbox.checked && elementHTML.startsWith('<p>')) {
                tempDiv.style.textAlign = 'justify';
            }

            tempDiv.innerHTML = elementHTML;
            document.body.appendChild(tempDiv);
            const height = tempDiv.getBoundingClientRect().height;
            document.body.removeChild(tempDiv);
            const blockBuffer = 1;
            return height + blockBuffer;
        }

        for (const block of content) {
            const blockHeight = estimateHeight(block);
            const tolerance = 1;
            if (currentPageHeight + blockHeight > pageHeight + tolerance && currentPageContent.length > 0) {
                bookPages.push(currentPageContent);
                currentPageContent = [block];
                currentPageHeight = blockHeight;
            } else {
                currentPageContent.push(block);
                currentPageHeight += blockHeight;
            }
        }
        if (currentPageContent.length > 0) {
            bookPages.push(currentPageContent);
        }
        console.log("Paginated Pages:", bookPages);
        return bookPages;
    }


    // --- Render Pages & Update Progress ---
    function renderPage(pageIndex) {
        const isDesktop = window.innerWidth >= 768;
        const totalBookPages = pages.length;

        if (totalBookPages > 0) {
            const displayPageStart = isDesktop ? (pageIndex * 2) + 1 : pageIndex + 1;
            const displayPageEnd = isDesktop ? Math.min((pageIndex * 2) + 2, totalBookPages) : pageIndex + 1;

            const progressTextExpanded = `Page ${displayPageStart}${isDesktop && displayPageEnd > displayPageStart ? '-' + displayPageEnd : ''} of ${totalBookPages}`;
            menuPageInfo.textContent = progressTextExpanded;
            progressSectionExpanded.style.display = 'block';

            // Vertical progress: current page (center of spread for desktop) / total pages
            const currentProgressPage = isDesktop ? displayPageStart : displayPageStart;
            verticalPageInfo.textContent = `${currentProgressPage}\n━━\n${totalBookPages}`;
            collapsedProgress.style.display = 'block';

        } else {
            menuPageInfo.textContent = "Page 0 of 0";
            progressSectionExpanded.style.display = 'none';
            verticalPageInfo.textContent = "0\n━━\n0";
            collapsedProgress.style.display = 'none';
        }

        pageLeft.innerHTML = '';
        pageRight.innerHTML = '';

        if (isDesktop) {
            const leftPageIndex = pageIndex * 2;
            const rightPageIndex = pageIndex * 2 + 1;
            if (pages[leftPageIndex]) pageLeft.innerHTML = pages[leftPageIndex].join('');
            if (pages[rightPageIndex]) pageRight.innerHTML = pages[rightPageIndex].join('');
        } else {
            if (pages[pageIndex]) pageLeft.innerHTML = pages[pageIndex].join('');
        }

        pageLeft.scrollTop = 0;
        pageRight.scrollTop = 0;

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
        if (currentPage < totalPageSets - 1) {
            currentPage++;
            renderPage(currentPage);
        }
    }

    function prevPage() {
        if (currentPage > 0) {
            currentPage--;
            renderPage(currentPage);
        }
    }

    document.addEventListener('keydown', (event) => {
        if (bookContent.length > 0 && !sideMenu.classList.contains('expanded')) { // Only when menu is collapsed or on mobile where it overlays
            if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
                nextPage(); event.preventDefault();
            } else if (event.key === 'ArrowLeft') {
                prevPage(); event.preventDefault();
            }
        }
        if (event.key === 'Escape' && sideMenu.classList.contains('expanded')) {
            toggleMenu(); // Close menu with Escape
        }
    });

    pageLeft.addEventListener('click', (event) => {
         // Prevent click handling if menu is expanded and overlay is visible
        if (bookContent.length > 0 && !sideMenu.classList.contains('expanded')) {
            // On desktop, if clicking on the left half of the left page, go previous.
            // On mobile, any click on left page goes previous.
            if (window.innerWidth >=768) {
                if (event.clientX < pageLeft.offsetWidth / 2) prevPage();
                else nextPage(); // Or next if on right half
            } else {
                 prevPage();
            }
        }
    });

    pageRight.addEventListener('click', () => {
        if (bookContent.length > 0 && !sideMenu.classList.contains('expanded')) {
             nextPage();
         }
    });


    // --- Load Content and Initialize ---
    let currentlyLoadedBookTitle = null;

    function showLoadingScreenInterface() { // Renamed for clarity
        loadingArea.style.display = 'block';
        bookContainer.style.display = 'none';
        sideMenu.style.display = 'none'; // Hide new sidebar on loading screen
        document.body.classList.remove('book-loaded');
        document.body.classList.remove('menu-expanded'); // Ensure this is reset
        currentlyLoadedBookTitle = null;
        listSavedBooks();
        listRecentBooks();
    }

    async function loadBookFromURL(url, title, initialPage = 0) {
         loadingStatus.textContent = `Loading from URL: ${url}...`;
         try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const markdownText = await response.text();
            loadContent(markdownText, initialPage, title);
            addRecentBook({ title: title, url: url });
         } catch (error) {
             console.error("Error fetching markdown from URL:", error);
             loadingStatus.textContent = `Error loading URL: ${error.message}`;
             showLoadingScreenInterface();
         }
    }


    function loadContent(markdownText, initialPage = 0, title = 'Untitled Book') {
        loadingStatus.textContent = 'Parsing content...';
        bookContent = parseMarkdown(markdownText);
        loadingStatus.textContent = 'Paginating content...';
        pages = paginateContent(bookContent);

        if (pages.length > 0) {
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(initialPage, totalPageSets > 0 ? totalPageSets - 1 : 0);

            renderPage(currentPage);
            loadingArea.style.display = 'none';
            bookContainer.style.display = 'flex';
            sideMenu.style.display = 'flex'; // Show new sidebar
            document.body.classList.add('book-loaded');
            loadingStatus.textContent = '';
            currentlyLoadedBookTitle = title;
            // Ensure menu is collapsed initially when a new book loads
            if (sideMenu.classList.contains('expanded')) {
                toggleMenu(false); // Force collapse, don't toggle
            }
            collapsedProgress.style.display = 'block'; // Show collapsed progress
        } else {
            loadingStatus.textContent = 'Could not process book content or book is empty.';
            menuPageInfo.textContent = "Page 0 of 0";
            progressSectionExpanded.style.display = 'none';
            verticalPageInfo.textContent = "";
            collapsedProgress.style.display = 'none';
            showLoadingScreenInterface();
        }
    }

    // --- Event Listeners for Loading ---
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            loadingStatus.textContent = `Loading file: ${file.name}...`;
            const reader = new FileReader();
            reader.onload = (e) => {
                const title = file.name.replace(/\.md$/, '');
                loadContent(e.target.result, 0, title);
                addRecentBook({ title: title, url: null });
            };
            reader.onerror = (e) => loadingStatus.textContent = `Error loading file: ${e.target.error}`;
            reader.readAsText(file);
        }
    });

    loadUrlButton.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (url) {
            const urlParts = url.split('/');
            const placeholderTitle = urlParts[urlParts.length - 1].replace(/\.md$/, '') || 'Untitled URL Book';
            loadBookFromURL(url, placeholderTitle);
        } else {
            loadingStatus.textContent = 'Please enter a URL.';
        }
    });

    // --- Repository Book List and Search ---
    async function fetchRepositoryBooks() {
        try {
            const response = await fetch('books_index.json');
            if (!response.ok) {
                 document.querySelector('.load-option h3').textContent = 'Repository books not available.';
                 bookSearchInput.style.display = 'none';
                 repositoryBooksList.style.display = 'none';
                 return;
            }
            allRepositoryBooks = await response.json();
            renderRepositoryBooks(allRepositoryBooks);
        } catch (error) {
            console.error("Error fetching repository book index:", error);
             document.querySelector('.load-option h3').textContent = 'Error loading repository books.';
             bookSearchInput.style.display = 'none';
             repositoryBooksList.style.display = 'none';
        }
    }

    function renderRepositoryBooks(booksToRender) {
        repositoryBooksList.innerHTML = '';
        if (booksToRender.length > 0) {
            booksToRender.forEach(book => {
                const li = document.createElement('li');
                li.textContent = `${book.title} by ${book.author} (${book.year})`;
                li.dataset.url = book.url;
                li.dataset.title = book.title;
                li.addEventListener('click', () => loadBookFromURL(book.url, book.title));
                repositoryBooksList.appendChild(li);
            });
        } else {
            repositoryBooksList.innerHTML = '<li>No books found matching your search.</li>';
        }
    }

    function filterRepositoryBooks() {
        const searchTerm = bookSearchInput.value.toLowerCase();
        const filteredBooks = allRepositoryBooks.filter(book =>
            book.title.toLowerCase().includes(searchTerm) || book.author.toLowerCase().includes(searchTerm)
        );
        renderRepositoryBooks(filteredBooks);
    }


    // --- Menu Toggling (New Sidebar) ---
    function toggleMenu(forceState) { // forceState can be true (expand) or false (collapse)
        const isCurrentlyExpanded = sideMenu.classList.contains('expanded');
        const expand = forceState === undefined ? !isCurrentlyExpanded : forceState;

        if (expand) {
            sideMenu.classList.add('expanded');
            expandedMenuContent.classList.remove('hidden');
            document.body.classList.add('menu-expanded');
             if (window.innerWidth >= 768) overlay.classList.add('active'); // Show overlay on desktop when expanded
        } else {
            sideMenu.classList.remove('expanded');
            expandedMenuContent.classList.add('hidden');
            document.body.classList.remove('menu-expanded');
            if (window.innerWidth >= 768) overlay.classList.remove('active'); // Hide overlay
        }

        // Re-paginate because sidebar width changes affect page width
        if (bookContent.length > 0) {
            pages = paginateContent(bookContent);
            renderPage(currentPage);
        }
    }

    menuToggle.addEventListener('click', () => toggleMenu());
    overlay.addEventListener('click', () => {
        if (sideMenu.classList.contains('expanded')) {
            toggleMenu(false); // Force collapse
        }
    });


    // --- Theme and Justification Event Listeners ---
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => setTheme(event.target.value));
    });
    justifyTextCheckbox.addEventListener('change', (event) => {
        setJustifyText(event.target.checked);
    });


    window.addEventListener('resize', () => {
        if (bookContent.length > 0) {
            // If transitioning between mobile/desktop, menu state might need adjustment
            if (window.innerWidth < 768) {
                // On mobile, if menu was expanded via desktop style, ensure it's correctly overlaying
                // The CSS should handle this, but JS can ensure body class is correct
                if (sideMenu.classList.contains('expanded')) {
                    document.body.classList.add('menu-expanded'); // Ensure this class if menu is open
                }
                overlay.classList.remove('active'); // Overlay logic is simpler on mobile (CSS driven by menu state)

            } else { // Desktop
                if (sideMenu.classList.contains('expanded')) {
                     overlay.classList.add('active');
                } else {
                    overlay.classList.remove('active');
                }
            }

            pages = paginateContent(bookContent);
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            if (currentPage >= totalPageSets) {
                currentPage = totalPageSets > 0 ? totalPageSets - 1 : 0;
            }
            renderPage(currentPage);
        }
    });

    // --- Initialization ---
    function init() {
        applySavedTheme();
        applySavedJustification();
        listSavedBooks();
        listRecentBooks();
        fetchRepositoryBooks();
        showLoadingScreenInterface(); // Start with loading screen

        clearSavedBooksButton.addEventListener('click', clearSavedBooks);
        clearRecentBooksButton.addEventListener('click', clearRecentBooks);
        bookSearchInput.addEventListener('input', filterRepositoryBooks);

        // Initial check for desktop to hide overlay if menu isn't expanded
        if (window.innerWidth >= 768 && !sideMenu.classList.contains('expanded')) {
            overlay.classList.remove('active');
        }
    }

    init();

});