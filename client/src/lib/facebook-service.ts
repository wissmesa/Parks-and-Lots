import { getFacebookConfigByParkName, FacebookParkConfig, FACEBOOK_WEBHOOK_URL } from './facebook-config';

export interface FacebookPostRequest {
  parkName: string;
  facebookId: string | null;
  timestamp: string;
  userId?: string;
}

export interface FacebookPostResponse {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Sends a Facebook post request to the webhook
 * @param parkName - The name of the park
 * @param userId - Optional user ID for tracking
 * @returns Promise with the response
 */
export async function sendFacebookPostRequest(
  parkName: string, 
  userId?: string
): Promise<FacebookPostResponse> {
  try {
    // Get the Facebook ID for this park (if available)
    const config = getFacebookConfigByParkName(parkName);
    const facebookId = config?.facebookId || null;

    // Prepare the request data
    const requestData: FacebookPostRequest = {
      parkName: parkName,
      facebookId: facebookId,
      timestamp: new Date().toISOString(),
      userId: userId
    };

    // Send the webhook request
    const response = await fetch(FACEBOOK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    // Try to parse JSON response, but handle non-JSON responses gracefully
    let responseData;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Extract data from webhook response
    let webhookData = null;
    if (responseData) {
      if (typeof responseData === 'object') {
        // If response is already an object
        webhookData = responseData;
      } else if (typeof responseData === 'string') {
        // If response is a string, try to parse it as JSON
        try {
          webhookData = JSON.parse(responseData);
        } catch {
          // If it's not JSON, treat the entire string as the data
          webhookData = responseData;
        }
      }
    }

    return {
      success: true,
      message: `Webhook request sent successfully for ${parkName}`,
      data: {
        webhookResponse: webhookData
      }
    };

  } catch (error) {
    console.error('Error sending webhook request:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: {
        facebookId: null
      }
    };
  }
}

