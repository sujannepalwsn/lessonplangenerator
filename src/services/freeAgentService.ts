/**
 * FreeAgentMetadataExtractor calls the server-side API to extract metadata using rule-based parsing.
 */
export async function extractMetadataFreeAgent(pdfBase64: string): Promise<{ title: string, subject: string, class: string }> {
  try {
    const response = await fetch("/api/extract-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pdfBase64 }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("FreeAgentMetadataExtractor error:", error);
    return { title: "Unknown", subject: "General", class: "General" };
  }
}
