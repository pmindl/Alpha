
import json

TAXONOMY = {
    "STATUS": ["New", "Processed", "Waiting-for-reply", "Closed"],
    "TYPE": [
        "Order", "Complaint", "Return", "Shipping", "Payment", 
        "Product-inquiry", "General-inquiry", "Supplier", 
        "Newsletter-inbound", "Spam", "Internal"
    ],
    "FINANCE": [
        "Invoice-incoming", "Invoice-overdue", "Invoice-outgoing", 
        "Payment-confirmation", "Credit-note", "Contract"
    ],
    "ACTION": [
        "Prepare-reply", "Escalate", "Forward-internally", 
        "No-action", "Waiting-for-info"
    ],
    "PRIORITY": ["Urgent", "Normal", "Low"],
    "DRAFT": [] # Managed by other agents
}

def get_full_label_list():
    """Returns a flat list of all fully qualified labels (e.g. STATUS/New)."""
    labels = []
    for category, items in TAXONOMY.items():
        if category == "DRAFT": continue # Don't manage DRAFT
        for item in items:
            labels.append(f"{category}/{item}")
    return labels

def get_taxonomy_dict():
    """Returns the taxonomy dictionary."""
    return TAXONOMY

def main():
    """Prints taxonomy as JSON (for MCP tool)."""
    print(json.dumps(get_taxonomy_dict(), indent=2))

if __name__ == "__main__":
    main()
