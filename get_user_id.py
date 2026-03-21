import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(".env")
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)
response = supabase.auth.admin.list_users()

users = getattr(response, 'users', response) # handle different supabase-py versions

if users and len(users) > 0:
    print(users[0].id)
else:
    new_user = supabase.auth.admin.create_user({
        "email": "test@saasfactory.com",
        "password": "password123",
        "email_confirm": True
    })
    print(new_user.user.id)
