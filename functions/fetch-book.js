// functions/fetch-book.js

function cleanTextAndExtractMetadata(text, titleHintForPreambleStripper) {
    let lines = text.split('\n');
    let extractedTitle = null;
    let extractedAuthor = null;
    let actualContentStartIndex = -1; // Line index where the main book content (e.g. Chapter 1) starts

    // Keywords that often signal the start of the main content
    const contentStartKeywords = [
        "chapter 1", "chapter i", "part one", "part i", "book one", "book i",
        "prologue", "foreword", "preface", "introduction",
        // Add the titleHint as a potential start marker, especially if it's repeated
        (titleHintForPreambleStripper || "a very unlikely string to match").toLowerCase()
    ];

    // Find the line number where the actual content likely begins
    for (let i = 0; i < lines.length; i++) {
        const lineTrimmedLower = lines[i].trim().toLowerCase();
        // Check if the line *starts with* a content start keyword.
        // For title hint, it should be a more exact match if it's the title itself.
        if (contentStartKeywords.some(marker => {
            if (marker === (titleHintForPreambleStripper || "").toLowerCase() && marker.length > 3) { // More exact for title
                return lineTrimmedLower === marker;
            }
            return lineTrimmedLower.startsWith(marker);
        })) {
            actualContentStartIndex = i;
            break;
        }
    }
    
    // If no strong marker, make a guess (e.g. after first 30-60 lines of typical preamble)
    if (actualContentStartIndex === -1) {
        let potentialEnd = Math.min(60, lines.length -1); // Don't go past end of doc
        for(let i = potentialEnd; i > 0; i--) { // Search backwards for first significant content block
            if (lines[i].trim().length > 20 && lines[i-1] && lines[i-1].trim() === "") { // Non-empty line after a blank line
                actualContentStartIndex = i;
                break;
            }
        }
        if (actualContentStartIndex === -1) actualContentStartIndex = 0; // Ultimate fallback
        console.warn("No strong content start marker found for preamble stripping; using heuristic position: " + actualContentStartIndex);
    }

    // Now, search for Title: and Author: lines in the block *before* actualContentStartIndex
    let searchEndIndex = actualContentStartIndex;
    let searchStartIndex = 0; // Search from beginning up to content start

    for (let i = searchStartIndex; i < searchEndIndex; i++) {
        const line = lines[i];
        const lineLower = line.toLowerCase().trim();
        if (lineLower.startsWith("title:")) {
            const titleValue = line.substring("title:".length).trim();
            if (titleValue) extractedTitle = titleValue; // Overwrite if multiple found, take last one before content
        } else if (lineLower.startsWith("author:")) {
            const authorValue = line.substring("author:".length).trim();
            if (authorValue) extractedAuthor = authorValue;
        }
    }

    // If title still not found from content, use the hint from URL/filename (passed by client)
    if (!extractedTitle && titleHintForPreambleStripper) {
        extractedTitle = titleHintForPreambleStripper;
    }

    // --- Construct the output ---
    let body = "";
    if (actualContentStartIndex !== -1 && actualContentStartIndex < lines.length) {
        body = lines.slice(actualContentStartIndex).join('\n').trim();
    } else {
        console.warn("Could not confidently determine content start; preamble stripping might be incomplete.");
        body = text; // Fallback to original text
        // Re-attempt extraction if body is the whole text
        if (!extractedTitle && titleHintForPreambleStripper) extractedTitle = titleHintForPreambleStripper;
        if (!extractedTitle) { const tm = text.match(/^Title:\s*(.*)/im); if (tm) extractedTitle = tm[1].trim(); }
        if (!extractedAuthor) { const am = text.match(/^Author:\s*(.*)/im); if (am) extractedAuthor = am[1].trim(); }
    }

    let prependedHeader = "";
    if (extractedTitle) prependedHeader += `# ${extractedTitle.trim()}\n`;
    if (extractedAuthor) prependedHeader += `## ${extractedAuthor.trim()}\n`;
    if (prependedHeader) prependedHeader += "\n";
    
    console.log(`PGA/TXT Processed. Header: '${prependedHeader.trim()}', Body starts from original line ~${actualContentStartIndex}.`);
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
                    sourceEncoding = bookUrl.endsWith('.txt') ? 'iso-8859-1' : 'utf-8';
                }
            } else if (bookUrl.endsWith('.txt')) sourceEncoding = 'iso-8859-1';
        } else if (bookUrl.endsWith('.txt')) sourceEncoding = 'iso-8859-1';
        
        console.log(`Decoding with source encoding: ${sourceEncoding} for URL: ${bookUrl}`);
        try {
            textContent = new TextDecoder(sourceEncoding, { fatal: true }).decode(arrayBuffer);
        } catch (e) {
            console.warn(`Fatal decode as ${sourceEncoding} failed: ${e.message}. Trying non-fatal UTF-8.`);
            textContent = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        }

        if (bookUrl.endsWith('.txt') && (bookUrl.includes("gutenberg.net.au") || bookUrl.includes("archive.org"))) {
            console.log(`Applying text cleaning and metadata extraction for: ${bookUrl}`);
            textContent = cleanTextAndExtractMetadata(textContent, bookTitleHint);
        }
        
        return new Response(textContent, { headers: { 'Content-Type': `text/plain; charset=${finalEncoding}` } });
    } catch (error) {
        console.error('Cloudflare Function Error in fetch-book:', error);
        return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
}