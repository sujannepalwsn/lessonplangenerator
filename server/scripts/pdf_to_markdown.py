import sys
import os
from docling.datamodel.base_models import InputFormat
from docling.document_converter import DocumentConverter

def main():
    if len(sys.argv) < 2:
        print("Usage: python pdf_to_markdown.py <pdf_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"Error: File {pdf_path} not found")
        sys.exit(1)

    try:
        converter = DocumentConverter()
        result = converter.convert(pdf_path)
        markdown_content = result.document.export_to_markdown()
        print(markdown_content)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
