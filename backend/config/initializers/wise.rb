# frozen_string_literal: true

WISE_API_KEY = GlobalConfig.get("WISE_API_KEY")
WISE_PROFILE_ID = GlobalConfig.get("WISE_PROFILE_ID")
WISE_API_URL = Rails.env.production? ? "https://api.transferwise.com" : "https://api.sandbox.transferwise.tech"
