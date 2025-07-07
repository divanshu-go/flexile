# frozen_string_literal: true

class Api::V1::LoginController < Api::BaseController

  def create
    email = params[:email]

    if email.blank?
      return render json: { error: "Email is required" }, status: :bad_request
    end

    user = User.find_by(email: email)
    unless user
      return render json: { error: "User not found" }, status: :not_found
    end

    jwt_token = generate_jwt_token(user)
    render json: { jwt: jwt_token, user: user_data(user) }, status: :ok
  end

  private

  def generate_jwt_token(user)
    payload = {
      user_id: user.id,
      email: user.email,
      exp: 24.hours.from_now.to_i
    }

    JWT.encode(payload, jwt_secret, 'HS256')
  end

  def jwt_secret
    GlobalConfig.get('JWT_SECRET', Rails.application.secret_key_base)
  end

  def user_data(user)
    {
      id: user.id,
      email: user.email,
      name: user.name,
      legal_name: user.legal_name,
      preferred_name: user.preferred_name
    }
  end
end