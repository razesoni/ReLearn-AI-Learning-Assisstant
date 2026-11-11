from ddgs import DDGS
from langchain_core.tools import tool

@tool
def web_search(query: str, max_results: int = 3):
    """Search the web using DuckDuckGo and return titles, URLs, and snippets."""
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=max_results))
    out = [
        f"Title: {result.get('title')}\nURL: {result.get('href')}\nSnippet: {result.get('body', '')[:300]}\n"
        for result in results
    ]
    if not out:
        return "No search results found."
    return "\n----\n".join(out)

if __name__ == "__main__":
    print(web_search.invoke("Tell me aboult machine learning"))