from docling.document_converter import DocumentConverter
import sys

def test():
    print("Testing docling...")
    # We need a dummy pdf or something.
    # Just check if we can initialize it.
    try:
        converter = DocumentConverter()
        print("Docling initialized successfully.")
    except Exception as e:
        print(f"Error initializing docling: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test()
