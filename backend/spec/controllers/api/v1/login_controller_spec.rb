# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Api::V1::LoginController, type: :controller do
  describe 'POST #create' do
    let(:user) { create(:user) }
    let(:valid_token) { Rails.application.secret_key_base }
    let(:invalid_token) { 'invalid_token' }

    context 'with valid parameters' do
      it 'returns a JWT token and user data' do
        post :create, params: { email: user.email, token: valid_token }

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response['jwt']).to be_present
        expect(json_response['user']['id']).to eq(user.id)
        expect(json_response['user']['email']).to eq(user.email)
      end
    end

    context 'with invalid token' do
      it 'returns unauthorized' do
        post :create, params: { email: user.email, token: invalid_token }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response['error']).to eq('Invalid token')
      end
    end

    context 'with non-existent user' do
      it 'returns not found' do
        post :create, params: { email: 'nonexistent@example.com', token: valid_token }

        expect(response).to have_http_status(:not_found)

        json_response = JSON.parse(response.body)
        expect(json_response['error']).to eq('User not found')
      end
    end

        context 'with missing parameters' do
      it 'returns bad request when email is missing' do
        post :create, params: { token: valid_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response['error']).to eq('Email is required')
      end

      it 'returns bad request when token is missing' do
        post :create, params: { email: user.email }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response['error']).to eq('Token is required')
      end
    end

    context 'JWT token validation' do
      it 'generates a valid JWT token' do
        post :create, params: { email: user.email, token: valid_token }

        json_response = JSON.parse(response.body)
        jwt_token = json_response['jwt']

        decoded_token = JWT.decode(jwt_token, Rails.application.secret_key_base, true, { algorithm: 'HS256' })
        payload = decoded_token[0]

        expect(payload['user_id']).to eq(user.id)
        expect(payload['email']).to eq(user.email)
        expect(payload['exp']).to be > Time.current.to_i
      end
    end
  end
end