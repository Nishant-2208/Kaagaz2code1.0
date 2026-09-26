import re

def normalize_string(value: str | None) -> str:
    """
    Normalizes a string for comparison.
    Converts to lowercase, strips, normalizes spacing,
    and standardizes common units.
    """
    if not value:
        return ""
    
    value = value.lower().strip()
    
    # Normalize common area terms
    value = value.replace("hectares", "हेक्टेयर")
    value = value.replace("hectare", "हेक्टेयर")
    value = value.replace("sq.m.", "वर्ग मीटर")
    value = value.replace("sqm", "वर्ग मीटर")
    
    # Remove extra spaces
    value = re.sub(r'\s+', ' ', value)
    
    return value
