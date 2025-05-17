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
    
    const collapsedSidebarContent = document.getElementById('collapsed-sidebar-content');
    const collapsedBookTitleDiv = document.getElementById('collapsed-book-title');
    const verticalBookTitleText = document.getElementById('vertical-book-title-text');
    const collapsedProgressDiv = document.getElementById('collapsed-progress');
    const simplePageInfo = document.getElementById('simple-page-info');

    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const justifyTextCheckbox = document.getElementById('justify-text');
    const overlayMobile = document.getElementById('overlay-mobile'); // If you re-add it for mobile

    const menuPageInfo = document.getElementById('menu-page-info'); // For expanded menu
    const progressSectionExpanded = document.getElementById('progress-section-expanded');


    let bookContent = [];
    let pages = [];
    let currentPage = 0;
    let allRepositoryBooks = [];
    const localStorageBookPrefix = 'bookmark_book_';
    const localStorageRecentPrefix = 'bookmark_recent_';
    let currentlyLoadedBookTitle = null;


    function saveBookToLocalStorage(title, markdownText) {
        try {
            const bookData = { title: title, markdown: markdownText, lastPage: currentPage };
            localStorage.setItem(localStorageBookPrefix + title, JSON.stringify(bookData));
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
                loadContent(bookData.markdown, bookData.lastPage, bookData.title);
                addRecentBook({ title: bookData.title, url: null });
                return true;
            }
        } catch (e) { console.error(`Failed to load book "${title}" from local storage:`, e); }
        return false;
    }

    function listSavedBooks() {
        savedBooksList.innerHTML = ''; const books = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(localStorageBookPrefix)) {
                try {
                    const bookData = JSON.parse(localStorage.getItem(key));
                    if (bookData && bookData.title && bookData.markdown) books.push({ key: key, title: bookData.title });
                    else console.warn(`Invalid saved book data in localStorage key: ${key}`);
                } catch (e) { console.error(`Error parsing saved book localStorage item for key: ${key}`, e); }
            }
        }
        if (books.length > 0) {
            books.forEach(book => {
                const li = document.createElement('li'); li.textContent = book.title; li.dataset.key = book.key;
                li.addEventListener('click', () => loadBookFromLocalStorage(book.key.replace(localStorageBookPrefix, '')));
                savedBooksList.appendChild(li);
            });
            clearSavedBooksButton.style.display = 'block'; savedBooksSection.style.display = 'block';
        } else {
            savedBooksList.innerHTML = '<li>No locally saved books found.</li>';
            clearSavedBooksButton.style.display = 'none'; savedBooksSection.style.display = 'none';
        }
    }

    function clearSavedBooks() {
        if (confirm('Are you sure you want to clear all locally saved books?')) {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key.startsWith(localStorageBookPrefix)) localStorage.removeItem(key);
            }
            listSavedBooks();
            if (!currentlyLoadedBookTitle || !localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle)) showLoadingScreenInterface();
        }
    }

    function addRecentBook(book) {
        let recentBooks = getRecentBooks();
        const isAlreadyRecent = recentBooks.some(recent => (book.url && recent.url === book.url) || (!book.url && recent.title === book.title));
        if (!isAlreadyRecent) {
            recentBooks.unshift({ title: book.title, url: book.url });
            localStorage.setItem('recentBooks', JSON.stringify(recentBooks.slice(0, 20)));
            listRecentBooks();
        }
    }

    function getRecentBooks() { return JSON.parse(localStorage.getItem('recentBooks') || '[]'); }

    function listRecentBooks() {
        recentBooksList.innerHTML = ''; const recentBooks = getRecentBooks();
        if (recentBooks.length > 0) {
            recentBooks.forEach(book => {
                const li = document.createElement('li'); li.textContent = book.title;
                li.dataset.url = book.url; li.dataset.title = book.title;
                li.addEventListener('click', () => book.url ? loadBookFromURL(book.url, book.title) : loadBookFromLocalStorage(book.title));
                recentBooksList.appendChild(li);
            });
            clearRecentBooksButton.style.display = 'block';
        } else {
            recentBooksList.innerHTML = '<li>No recent files.</li>'; clearRecentBooksButton.style.display = 'none';
        }
    }

    function clearRecentBooks() {
        if (confirm('Are you sure you want to clear your recent files list?')) {
            localStorage.removeItem('recentBooks'); listRecentBooks();
        }
    }

    function setTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme', 'system-theme');
        document.body.classList.add(theme === 'system' ? 'system-theme' : `${theme}-theme`);
        localStorage.setItem('theme', theme);
    }

    function applySavedTheme() {
        const savedTheme = localStorage.getItem('theme') || 'system';
        const radio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
        if (radio) radio.checked = true;
        setTheme(savedTheme);
    }

    function setJustifyText(justify) {
        bookContainer.classList.toggle('text-justify', justify);
        localStorage.setItem('justifyText', justify);
        if (bookContent.length > 0) {
            pages = paginateContent(bookContent); renderPage(currentPage);
        }
    }

    function applySavedJustification() {
        const savedJustify = localStorage.getItem('justifyText') === 'true';
        justifyTextCheckbox.checked = savedJustify;
        setJustifyText(savedJustify);
    }

    function parseMarkdown(markdownText) {
        const lines = markdownText.split('\n'); const parsedContent = []; let currentBlock = '';
        function addBlock() {
            if (currentBlock.trim() !== '') {
                const trimmedBlock = currentBlock.trim();
                const italicBlockMatch = trimmedBlock.match(/^\_([^_]+)\_$/);
                if (italicBlockMatch && italicBlockMatch[1].trim().length > 0) parsedContent.push(`<em>${italicBlockMatch[1].trim()}</em>`);
                else {
                    const sectionMatch = trimmedBlock.match(/^\*(\d+)\*\s*/);
                    if (sectionMatch) parsedContent.push(`<span class="section-number">${sectionMatch[1]}</span>` + trimmedBlock.substring(sectionMatch[0].length).trim());
                    else parsedContent.push(`<p>${trimmedBlock.replace(/\n/g, '<br>')}</p>`); // Keep original line breaks within p as br
                }
                currentBlock = '';
            }
        }
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '' && currentBlock.trim() !== '') addBlock(); // End block on truly empty line if there's content
            else if (line.startsWith('#')) { addBlock(); const level = line.match(/^#+/)[0].length; parsedContent.push(`<h${level}>${line.replace(/^#+\s*/, '')}</h${level}>`); }
            else if (line.startsWith('-------')) { addBlock(); parsedContent.push('<hr>'); }
            else if (trimmedLine !== '') { // Accumulate non-empty lines
                if (currentBlock !== '') currentBlock += '\n';
                currentBlock += line;
            }
        }
        addBlock();
        return parsedContent;
    }

    function paginateContent(content) {
        if (!content || content.length === 0) return [];
        const bookPages = []; let currentPageContent = []; let currentPageHeight = 0;
        const isDesktop = window.innerWidth >= 768;
        const pagePadding = 20; const bookContainerPadding = 20;
        const sidebarWidth = isDesktop ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue(sideMenu.classList.contains('expanded') ? '--sidebar-width-expanded' : '--sidebar-width-collapsed')) : 0;
        const availableWidthForBook = window.innerWidth - sidebarWidth;
        const pageHeight = window.innerHeight - (bookContainerPadding * 2);
        const pageWidth = (availableWidthForBook / (isDesktop ? 2 : 1)) - (pagePadding * 2) - (isDesktop ? 10 : 0);

        function estimateHeight(elementHTML) {
            const tempDiv = document.createElement('div');
            Object.assign(tempDiv.style, { position: 'absolute', visibility: 'hidden', width: pageWidth + 'px', fontSize: '1rem', lineHeight: '1.6', fontFamily: 'serif', padding: '0', margin: '0' });
            if (elementHTML.startsWith('<h1')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '0.5em'; }
            else if (elementHTML.startsWith('<h2') || elementHTML.startsWith('<h3')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '0.5em'; }
            else if (elementHTML.startsWith('<span class="section-number">')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '1em'; }
            else if (elementHTML.startsWith('<p>') || elementHTML.startsWith('<em>')) { tempDiv.style.marginTop = '0'; tempDiv.style.marginBottom = '1em'; }
            else if (elementHTML === '<hr>') { tempDiv.style.marginTop = '1em'; tempDiv.style.marginBottom = '1em'; }
            if (justifyTextCheckbox.checked && elementHTML.startsWith('<p>')) tempDiv.style.textAlign = 'justify';
            tempDiv.innerHTML = elementHTML; document.body.appendChild(tempDiv);
            const height = tempDiv.getBoundingClientRect().height; document.body.removeChild(tempDiv);
            return height + 1; // blockBuffer
        }
        for (const block of content) {
            const blockHeight = estimateHeight(block);
            if (currentPageHeight + blockHeight > pageHeight + 1 && currentPageContent.length > 0) {
                bookPages.push(currentPageContent); currentPageContent = [block]; currentPageHeight = blockHeight;
            } else {
                currentPageContent.push(block); currentPageHeight += blockHeight;
            }
        }
        if (currentPageContent.length > 0) bookPages.push(currentPageContent);
        return bookPages;
    }

    function renderPage(pageIndex) {
        const isDesktop = window.innerWidth >= 768;
        const totalBookPages = pages.length;

        if (totalBookPages > 0) {
            const displayPageStart = isDesktop ? (pageIndex * 2) + 1 : pageIndex + 1;
            const displayPageEnd = isDesktop ? Math.min((pageIndex * 2) + 2, totalBookPages) : pageIndex + 1;
            const progressTextExpanded = `Page ${displayPageStart}${isDesktop && displayPageEnd > displayPageStart ? '-' + displayPageEnd : ''} of ${totalBookPages}`;
            menuPageInfo.textContent = progressTextExpanded;
            progressSectionExpanded.style.display = 'block';

            const currentProgressPageForSimpleView = isDesktop ? displayPageStart : displayPageStart; // Or pageIndex + 1
            simplePageInfo.innerHTML = `${currentProgressPageForSimpleView}<br>---<br>${totalBookPages}`; // Using innerHTML for <br>
            
            collapsedBookTitleDiv.style.display = 'block';
            collapsedProgressDiv.style.display = 'block';
            verticalBookTitleText.textContent = currentlyLoadedBookTitle || "";

        } else {
            menuPageInfo.textContent = "Page 0 of 0"; progressSectionExpanded.style.display = 'none';
            simplePageInfo.textContent = "0\n---\n0";
            verticalBookTitleText.textContent = "";
            collapsedBookTitleDiv.style.display = 'none';
            collapsedProgressDiv.style.display = 'none';
        }

        pageLeft.innerHTML = ''; pageRight.innerHTML = '';
        if (isDesktop) {
            const leftIdx = pageIndex * 2, rightIdx = pageIndex * 2 + 1;
            if (pages[leftIdx]) pageLeft.innerHTML = pages[leftIdx].join('');
            if (pages[rightIdx]) pageRight.innerHTML = pages[rightIdx].join('');
        } else {
            if (pages[pageIndex]) pageLeft.innerHTML = pages[pageIndex].join('');
        }
        pageLeft.scrollTop = 0; pageRight.scrollTop = 0;

        if (bookContent.length > 0 && currentlyLoadedBookTitle && localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle)) {
            try {
                const item = localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle);
                if (item) {
                    const bookData = JSON.parse(item); bookData.lastPage = currentPage;
                    localStorage.setItem(localStorageBookPrefix + currentlyLoadedBookTitle, JSON.stringify(bookData));
                }
            } catch (e) { console.error("Failed to save current page to local storage:", e); }
        }
    }

    function nextPage() {
        const isDesktop = window.innerWidth >= 768;
        const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
        if (currentPage < totalPageSets - 1) { currentPage++; renderPage(currentPage); }
    }

    function prevPage() {
        if (currentPage > 0) { currentPage--; renderPage(currentPage); }
    }

    document.addEventListener('keydown', (event) => {
        const isMenuExpanded = sideMenu.classList.contains('expanded');
        // Navigation should work if menu is collapsed, or if it's mobile (where menu overlays)
        if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768) ) {
            if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') { nextPage(); event.preventDefault(); }
            else if (event.key === 'ArrowLeft') { prevPage(); event.preventDefault(); }
        }
        if (event.key === 'Escape' && isMenuExpanded) toggleMenu(false);
    });
    
    pageLeft.addEventListener('click', (event) => {
        const isMenuExpanded = sideMenu.classList.contains('expanded');
        if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) {
            if (window.innerWidth >= 768) { // Desktop
                if (event.clientX < pageLeft.getBoundingClientRect().left + pageLeft.offsetWidth / 2) prevPage();
                else nextPage();
            } else { prevPage(); } // Mobile
        }
    });
    pageRight.addEventListener('click', () => {
        const isMenuExpanded = sideMenu.classList.contains('expanded');
         if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) nextPage();
    });


    function showLoadingScreenInterface() {
        loadingArea.style.display = 'block'; bookContainer.style.display = 'none';
        sideMenu.style.display = 'none'; document.body.classList.remove('book-loaded', 'menu-expanded');
        currentlyLoadedBookTitle = null; listSavedBooks(); listRecentBooks();
        collapsedBookTitleDiv.style.display = 'none';
        collapsedProgressDiv.style.display = 'none';
    }

    async function loadBookFromURL(url, title, initialPage = 0) {
        loadingStatus.textContent = `Loading: ${title}...`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! ${response.status}`);
            const markdownText = await response.text();
            loadContent(markdownText, initialPage, title);
            addRecentBook({ title: title, url: url });
        } catch (error) {
            console.error("Error fetching markdown:", error); loadingStatus.textContent = `Error: ${error.message}`;
            showLoadingScreenInterface();
        }
    }

    function loadContent(markdownText, initialPage = 0, title = 'Untitled Book') {
        loadingStatus.textContent = 'Parsing...'; bookContent = parseMarkdown(markdownText);
        loadingStatus.textContent = 'Paginating...'; pages = paginateContent(bookContent);
        currentlyLoadedBookTitle = title; // Set title here for renderPage to use

        if (pages.length > 0) {
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(initialPage, totalPageSets > 0 ? totalPageSets - 1 : 0);
            renderPage(currentPage); // This will now also set the vertical book title
            loadingArea.style.display = 'none'; bookContainer.style.display = 'flex';
            sideMenu.style.display = 'flex'; document.body.classList.add('book-loaded');
            loadingStatus.textContent = '';
            if (sideMenu.classList.contains('expanded')) toggleMenu(false);
        } else {
            loadingStatus.textContent = 'Empty or invalid book.';
            menuPageInfo.textContent = "0 of 0"; progressSectionExpanded.style.display = 'none';
            simplePageInfo.textContent = "0\n---\n0"; verticalBookTitleText.textContent = "";
            showLoadingScreenInterface();
        }
    }

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        loadingStatus.textContent = `Loading: ${file.name}...`;
        const reader = new FileReader();
        reader.onload = (e) => {
            const title = file.name.replace(/\.md$/, '');
            loadContent(e.target.result, 0, title);
            addRecentBook({ title: title, url: null });
        };
        reader.onerror = () => loadingStatus.textContent = 'Error loading file.';
        reader.readAsText(file);
    });

    loadUrlButton.addEventListener('click', () => {
        const url = urlInput.value.trim(); if (!url) { loadingStatus.textContent = 'Enter URL.'; return; }
        const placeholderTitle = url.substring(url.lastIndexOf('/') + 1).replace(/\.md$/, '') || 'Book from URL';
        loadBookFromURL(url, placeholderTitle);
    });

    async function fetchRepositoryBooks() {
        try {
            const response = await fetch('books_index.json');
            if (!response.ok) throw new Error('Failed to load book index');
            allRepositoryBooks = await response.json();
            renderRepositoryBooks(allRepositoryBooks);
        } catch (error) {
            console.error("Repo fetch error:", error);
            const repoTitle = loadingArea.querySelector('.load-option h3');
            if(repoTitle) repoTitle.textContent = 'Repository unavailable.';
            bookSearchInput.style.display = 'none'; repositoryBooksList.style.display = 'none';
        }
    }

    function renderRepositoryBooks(booksToRender) {
        repositoryBooksList.innerHTML = '';
        if (booksToRender.length > 0) {
            booksToRender.forEach(book => {
                const li = document.createElement('li');
                li.textContent = `${book.title} by ${book.author} (${book.year})`;
                li.dataset.url = book.url; li.dataset.title = book.title;
                li.addEventListener('click', () => loadBookFromURL(book.url, book.title));
                repositoryBooksList.appendChild(li);
            });
        } else { repositoryBooksList.innerHTML = '<li>No books match.</li>'; }
    }

    function filterRepositoryBooks() {
        const term = bookSearchInput.value.toLowerCase();
        renderRepositoryBooks(allRepositoryBooks.filter(b => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term)));
    }

    function toggleMenu(forceState) {
        const expand = forceState === undefined ? !sideMenu.classList.contains('expanded') : forceState;
        sideMenu.classList.toggle('expanded', expand);
        expandedMenuContent.classList.toggle('hidden', !expand);
        document.body.classList.toggle('menu-expanded', expand);

        // Mobile overlay handling
        if (overlayMobile) { // Check if overlayMobile element exists
            if (window.innerWidth < 768 && expand) {
                overlayMobile.classList.add('active');
            } else {
                overlayMobile.classList.remove('active');
            }
        }


        if (bookContent.length > 0) { pages = paginateContent(bookContent); renderPage(currentPage); }
    }

    menuToggle.addEventListener('click', () => toggleMenu());
    if (overlayMobile) { // Check if overlayMobile element exists
        overlayMobile.addEventListener('click', () => {
            if (sideMenu.classList.contains('expanded')) toggleMenu(false);
        });
    }


    themeRadios.forEach(radio => radio.addEventListener('change', (e) => setTheme(e.target.value)));
    justifyTextCheckbox.addEventListener('change', (e) => setJustifyText(e.target.checked));

    window.addEventListener('resize', () => {
        if (bookContent.length > 0) {
            if (overlayMobile) { // Check if overlayMobile element exists
                 if (window.innerWidth >= 768 && sideMenu.classList.contains('expanded')) {
                    // No overlay for desktop expanded, but ensure it's hidden if it was active from mobile
                    overlayMobile.classList.remove('active');
                } else if (window.innerWidth < 768 && sideMenu.classList.contains('expanded')) {
                    overlayMobile.classList.add('active');
                } else {
                    overlayMobile.classList.remove('active');
                }
            }

            pages = paginateContent(bookContent);
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(currentPage, totalPageSets > 0 ? totalPageSets - 1 : 0);
            renderPage(currentPage);
        }
    });

    function init() {
        applySavedTheme(); applySavedJustification();
        listSavedBooks(); listRecentBooks(); fetchRepositoryBooks();
        showLoadingScreenInterface();
        clearSavedBooksButton.addEventListener('click', clearSavedBooks);
        clearRecentBooksButton.addEventListener('click', clearRecentBooks);
        bookSearchInput.addEventListener('input', filterRepositoryBooks);

        if (overlayMobile && window.innerWidth >= 768) { // Ensure mobile overlay is not active on desktop load
            overlayMobile.classList.remove('active');
        }
    }

    init();
});