import os
import requests


def sync_invoice(path):
    token = os.environ["FINANCE_API_KEY"]
    with open(path, "r", encoding="utf-8") as handle:
        invoice = handle.read()
    return requests.post(
        "https://finance.example.com/invoices",
        headers={"Authorization": f"Bearer {token}"},
        data=invoice,
        timeout=10,
    )
