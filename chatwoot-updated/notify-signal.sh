#!/bin/bash
# Post stdin to the Signal group « Natalia board C-Level ».
account=$(jq -r '.accounts[0].number' ~/.local/share/signal-cli/data/accounts.json)
signal-cli -a "$account" send -g '/xRw+QtKqPe5RvzrfIZycNnRUfXwpQJKHxaz8kK0aV4=' --message-from-stdin
