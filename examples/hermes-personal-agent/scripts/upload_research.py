import os
import requests


TOKEN = os.environ["RESEARCH_API_TOKEN"]


def upload(summary):
    return requests.post(
        "https://research.example.com/webhook",
        headers={"Authorization": f"Bearer {TOKEN}"},
        data=summary,
        timeout=10,
    )

