// functions/fetch-book.js

function cleanTextAndExtractMetadata(text, titleHintForPreambleStripper) {
    let lines = text.split('\n');
    let extractedTitle = null;
    let extractedAuthor = null;
    let contentStartIndex = 0;
    const titleAuthorLinesIndices = new Set();

    // --- Stage 1: Try to identify and extract Title & Author from typical metadata block ---
    // Define patterns for Title and Author lines
    const titlePattern = /^title:\s*(.+)/i;
    const authorPattern = /^author:\s*(.+)/i;
    // Other common metadata lines to help identify end of metadata block or to remove
    const otherMetadataPatterns = [
        /^illustrator:\s*(.+)/i,
        /^translator:\s*(.+)/i,
        /^language:\s*(.+)/i,
        /^ebook no\.[:\s]*(.+)/i, // "EBook No.:" or "EBook No. :"
        /^release date:\s*(.+)/i,
        /^date first posted:\s*(.+)/i,
        /^date most recently updated:\s*(.+)/i,
        /^\*\*\* START OF (THIS |THE )?PROJECT GUTENBERG EBOOK/i, // Start marker
        /^\*\*\*\s*END OF (THIS |THE )?PROJECT GUTENBERG EBOOK/i // End marker
    ];

    let metadataBlockEndIndex = -1;

    for (let i = 0; i < Math.min(lines.length, 50); i++) { // Scan first 50 lines for metadata
        const currentLine = lines[i];
        const currentLineTrimmed = currentLine.trim();

        let match = currentLineTrimmed.match(titlePattern);
        if (match && match[1]) {
            extractedTitle = match[1].trim();
            titleAuthorLinesIndices.add(i);
            continue; 
        }

        match = currentLineTrimmed.match(authorPattern);
        if (match && match[1]) {
            extractedAuthor = match[1].trim();
            titleAuthorLinesIndices.add(i);
            continue;
        }

        if (otherMetadataPatterns.some(p => p.test(currentLineTrimmed))) {
            titleAuthorLinesIndices.add(i); // Mark for potential removal from body if they persist
            if (currentLineTrimmed.toLowerCase().startsWith("*** start of")) {
                 metadataBlockEndIndex = i; // Strong indicator
                 break;
            }
            continue;
        }

        // If we've found a title and author, and the current line is blank,
        // or something that doesn't look like continued metadata,
        // this might be the end of the explicit title/author block.
        if (extractedTitle && extractedAuthor && (currentLineTrimmed === "" || i > 10)) {
            metadataBlockEndIndex = i -1; // Previous line was last metadata
            break;
        }
        if (currentLineTrimmed === "" && i > 5 && (extractedTitle || extractedAuthor)) { // Blank line after some metadata
             metadataBlockEndIndex = i -1;
             break;
        }
         if (currentLineTrimmed !== "" && !otherMetadataPatterns.some(p => p.test(currentLineTrimmed)) && i > 5 && (extractedTitle || extractedAuthor)) {
            metadataBlockEndIndex = i - 1; // Non-metadata line after title/author found
            break;
        }
    }
    
    if (metadataBlockEndIndex === -1 && titleAuthorLinesIndices.size > 0) {
        metadataBlockEndIndex = Math.max(...Array.from(titleAuthorLinesIndices));
    } else if (metadataBlockEndIndex === -1) {
        metadataBlockEndIndex = 0; // No clear metadata block found
    }


    // --- Stage 2: Find the true start of the book's narrative content ---
    // This should be *after* the metadata block AND any remaining boilerplate.
    contentStartIndex = metadataBlockEndIndex + 1; // Start looking after identified metadata

    const pgaLicenseMarker = "gutenberg.net.au/license.html";
    const contentStartKeywords = [
        "chapter 1", "chapter i", "part one", "part i", "book one", "book i",
        "introduction", "prologue", "foreword", "preface",
        // Add the extracted title (if any) or titleHint as a very strong content start marker
        // This helps if the title is repeated just before the content.
        (extractedTitle || titleHintForPreambleStripper || "a^b^c").toLowerCase() // "a^b^c" as unlikely placeholder
    ];
    const genericPreambleEndMarkers = [ // For non-PGA sources primarily
        "*** end of this project gutenberg ebook",
        "*** end of the project gutenberg ebook",
        "* * * * *",
        "----------------------------------------------------"
    ];

    let foundContentStart = false;
    for (let i = contentStartIndex; i < lines.length; i++) {
        const lineTrimmed = lines[i].trim();
        const lineLower = lineTrimmed.toLowerCase();

        if (lineTrimmed === "") continue; // Skip blank lines when searching for start

        // Check for generic end-of-preamble markers (could appear before content start markers)
        if (genericPreambleEndMarkers.some(marker => lineLower.includes(marker))) {
            contentStartIndex = i + 1; // Content starts after this marker
            // Continue searching from here for a more specific contentStartKeyword
            continue;
        }
        
        // Check for explicit content start keywords
        if (contentStartKeywords.some(marker => lineLower.startsWith(marker))) {
            contentStartIndex = i;
            foundContentStart = true;
            break;
        }

        // Heuristic: If we've passed typical preamble length and find a non-boilerplate line
        const pgaBoilerplateKeywords = ["project gutenberg of australia", "ebook no", "language:", "date first posted", "date most recently updated", "be sure to check the copyright laws", "terms of the project gutenberg of australia license", "to contact project gutenberg of australia"];
        if (i > metadataBlockEndIndex + 10 && !pgaBoilerplateKeywords.some(key => lineLower.includes(key))) {
            // If line is not empty and doesn't seem like more PGA boilerplate after a buffer
            contentStartIndex = i;
            foundContentStart = true;
            console.log("Heuristic content start based on non-boilerplate line after buffer.");
            break;
        }
        
        if (i > contentStartIndex + 150) { // Safety break if preamble is excessively long
            console.warn("Preamble strip: Reached line limit after metadata block.");
            break;
        }
    }
    
    // Ensure contentStartIndex is valid and skips any leading blank lines from actual content
    while (contentStartIndex < lines.length && lines[contentStartIndex].trim() === "") {
        contentStartIndex++;
    }
    contentStartIndex = Math.min(contentStartIndex, lines.length);

    // --- Stage 3: Construct the final output ---
    let body = lines.slice(contentStartIndex).join('\n').trim();
    
    // If the actual title/author (from metadata extraction) still appears at the very start of 'body'
    // (because contentStartIndex was before them), remove them from body to avoid duplication.
    let tempBody = body;
    if (extractedTitle) {
        const titleRegex = new RegExp(`^${extractedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
        tempBody = tempBody.replace(titleRegex, '');
    }
    if (extractedAuthor) {
        const authorRegex = new RegExp(`^${extractedAuthor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
        tempBody = tempBody.replace(authorRegex, '');
    }
    body = tempBody.trimStart();


    let prependedHeader = "";
    // Use the title extracted from metadata first, then the hint
    const finalTitle = extractedTitle || titleHintForPreambleStripper;
    if (finalTitle) {
        prependedHeader += `# ${finalTitle}\n`;
    }
    if (extractedAuthor) {
        prependedHeader += `## ${extractedAuthor}\n`;
    }
    if (prependedHeader) {
        prependedHeader += "\n"; // Blank line after header
    }

    console.log(`PGA/TXT Processed. Final Title: '${finalTitle}', Author: '${extractedAuthor}'. Body starts from original line ~${contentStartIndex}.`);
    return prependedHeader + body;
}


export async function onRequestGet(context) {
    const { request } = context;
    const requestUrl = new URL(request.url);
    const bookUrl = requestUrl.searchParams.get('url');
    const bookTitleHint = requestUrl.searchParams.get('title');

    if (!bookUrl) return new Response('Missing book URL parameter', { status: 400 });

    try {
        const response = await fetch(bookUrl);
        if (!response.ok) return new Response(`Failed to fetch book: ${response.status} ${response.statusText}`, { status: response.status });

        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        let textContent;
        const finalEncoding = 'utf-8';
        let sourceEncoding = 'utf-8';

        if (contentType) {
            const charsetMatch = contentType.match(/charset=([^;]+)/i);
            if (charsetMatch && charsetMatch[1]) {
                const cs = charsetMatch[1].trim().toLowerCase();
                if (['latin1', 'iso-8859-1', 'windows-1252', 'cp1252'].includes(cs)) sourceEncoding = 'iso-8859-1';
                else if (cs === 'utf-8' || cs === 'utf8') sourceEncoding = 'utf-8';
                else {
                    console.warn(`Unsupported charset in Content-Type: ${cs}. Assuming ${bookUrl.endsWith('.txt') ? 'iso-8859-1' : 'utf-8'}.`);
                    sourceEncoding = bookUrl.endsWith('.txt') ? 'iso-8859-1' : 'utf-8';
                }
            } else if (bookUrl.endsWith('.txt')) sourceEncoding = 'iso-8859-1';
        } else if (bookUrl.endsWith('.txt')) sourceEncoding = 'iso-8859-1';
        
        console.log(`Decoding with source encoding: ${sourceEncoding} for URL: ${bookUrl}`);
        try {
            textContent = new TextDecoder(sourceEncoding, { fatal: true }).decode(arrayBuffer);
        } catch (e) {
            console.warn(`Fatal decode as ${sourceEncoding} failed: ${e.message}. Trying non-fatal UTF-8 as fallback.`);
            textContent = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        }

        // Process for preamble and title/author formatting
        if (bookUrl.endsWith('.txt') && (bookUrl.includes("gutenberg.net.au") || bookUrl.includes("archive.org/stream/"))) {
            console.log(`Applying preamble stripping and metadata extraction for: ${bookUrl}`);
            textContent = cleanTextAndExtractMetadata(textContent, bookTitleHint);
        }
        
        return new Response(textContent, { headers: { 'Content-Type': `text/plain; charset=${finalEncoding}` } });
    } catch (error) {
        console.error('Cloudflare Function Error:', error);
        return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
}