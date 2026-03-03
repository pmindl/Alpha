
import json

TAXONOMY = {
    "STATUS": ["New", "Processed", "Waiting-for-reply", "Closed"],
    "TYPE": [
        "Order", "Complaint", "Return", "Shipping", "Payment",
        "Product-inquiry", "General-inquiry", "Supplier",
        "Newsletter-inbound", "Spam", "Internal",
        "Finance", "Analytics", "Marketing", "Information"
    ],
    "FINANCE": [
        "Invoice-incoming", "Invoice-overdue", "Invoice-outgoing",
        "Payment-confirmation", "Credit-note", "Contract",
        "Reminder", "Refund"
    ],
    "ACTION": [
        "Prepare-reply", "Escalate", "Forward-internally",
        "No-action", "Waiting-for-info", "Archive"
    ],
    "PRIORITY": ["Urgent", "Normal", "Low"],
    "DRAFT": []  # Managed by other agents
}


def get_full_label_list():
    """Returns a flat list of all fully qualified labels (e.g. STATUS/New)."""
    labels = []
    for category, items in TAXONOMY.items():
        if category == "DRAFT":
            continue
        for item in items:
            labels.append(f"{category}/{item}")
    return labels


def get_taxonomy_for_prompt():
    """Returns taxonomy formatted for dynamic injection into Gemini system prompt.

    Example output:
      STATUS: New | Processed | Waiting-for-reply | Closed
      TYPE: Order | Complaint | Return | ...
    """
    lines = []
    for category, values in TAXONOMY.items():
        if category == "DRAFT":
            continue
        lines.append(f"  {category}: {' | '.join(values)}")
    return "\n".join(lines)


def get_taxonomy_dict():
    """Returns the taxonomy dictionary."""
    return TAXONOMY


def main():
    """Prints taxonomy as JSON (for MCP tool)."""
    print(json.dumps(get_taxonomy_dict(), indent=2))


if __name__ == "__main__":
    main()
