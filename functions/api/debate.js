// functions/api/debate.js

// Helper to ensure a consistent message format for the API
const createMessage = (role, content) => ({ role, content });

export async function onRequestPost(context) {
    try {
        const {
            userMessage,
            selectedText,     // Text selected by the user on the page
            fullPageContext,  // Full text of the current page(s)
            conversationHistory // Array of {role: 'user'/'assistant', content: '...'}
        } = await context.request.json();

        const apiKey = context.env.OPENAI_API_KEY; // Ensure this is set in Cloudflare Pages env vars
        if (!apiKey) {
            return new Response(JSON.stringify({ error: true, message: "OpenAI API key not configured on server." }), {
                status: 500, headers: { "Content-Type": "application/json" }
            });
        }

        let systemPromptContent = `You are "Book Debate Mate," an AI literary assistant and debater. The user is reading a book.`;

        if (selectedText) {
            systemPromptContent += `
They have specifically selected the following text for discussion:
--- SELECTED TEXT ---
${selectedText}
--- END SELECTED TEXT ---

This selection is part of a larger context from the current page(s):
--- FULL PAGE CONTEXT ---
${fullPageContext}
--- END FULL PAGE CONTEXT ---

Your primary focus for explanation and initial discussion should be the SELECTED TEXT. Use the FULL PAGE CONTEXT to understand its placement and broader meaning.
If the user's message seems to refer to something outside the selected text but within the full page context, address that as well.
Start by offering a brief insight or a thought-provoking question about the selected text (or full context if no selection). Then, engage with the user's message.`;
        } else {
            systemPromptContent += `
The current page content the user is viewing is:
--- FULL PAGE CONTEXT ---
${fullPageContext}
--- END FULL PAGE CONTEXT ---
Start by offering a brief insight or a thought-provoking question about this page content. Then, engage in a debate or discussion based on the user's message.`;
        }
        
        systemPromptContent += "\nAsk probing questions, offer different perspectives, and respond to the user's arguments or interpretations. Maintain a helpful, insightful, and engaging tone. Use the provided conversation history for the ongoing discussion.";

        const messages = [
            createMessage("system", systemPromptContent),
            ...(conversationHistory || []).map(msg => createMessage(msg.role, msg.content)), // Ensure correct format
            createMessage("user", userMessage)
        ];

        const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o", 
                messages: messages,
                temperature: 0.7,
                // max_tokens: 1500, // Optional
            })
        });

        if (!openAIResponse.ok) {
            const errorData = await openAIResponse.json().catch(() => ({ error: { message: "Unknown OpenAI API error structure." } }));
            console.error("OpenAI API Error Details:", errorData);
            return new Response(JSON.stringify({ 
                error: true, 
                message: `OpenAI API Error: ${errorData.error?.message || openAIResponse.statusText}` 
            }), {
                status: openAIResponse.status, headers: { "Content-Type": "application/json" }
            });
        }

        const chatData = await openAIResponse.json();

        if (!chatData.choices || !chatData.choices[0]?.message?.content) {
            console.error("Invalid response structure from OpenAI:", chatData);
            return new Response(JSON.stringify({ error: true, message: "OpenAI did not return a valid message content." }), {
                status: 500, headers: { "Content-Type": "application/json" }
            });
        }

        const assistantReply = chatData.choices[0].message.content;

        return new Response(JSON.stringify({
            reply: assistantReply
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        console.error("Error in /api/debate function:", err.message, err.stack);
        return new Response(JSON.stringify({
            error: true,
            message: err.message || "Unknown server error in debate function."
        }), {
            status: 500, headers: { "Content-Type": "application/json" }
        });
    }
}