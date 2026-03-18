#!/bin/bash
cd /Users/aniktahabilder/server/apps/RewardKeeper/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 3005
