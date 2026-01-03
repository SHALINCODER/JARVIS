const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

// Model specified by user
const PRIMARY_MODEL = 'deepseek/deepseek-r1-0528:free';

// Model list - primary model and fallbacks
const MODEL_VARIANTS = [
  'deepseek/deepseek-r1-0528:free',  // User specified model
  'deepseek/deepseek-r1-0528',        // Without :free suffix (fallback)
  'deepseek/deepseek-chat',           // Alternative DeepSeek model
];

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Cache for available models (to avoid fetching repeatedly)
let availableModelsCache: string[] | null = null;

// Function to get available DeepSeek models from OpenRouter
async function getAvailableDeepSeekModels(): Promise<string[]> {
  if (availableModelsCache) {
    return availableModelsCache;
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const deepseekModels = data.data
        ?.filter((model: any) => model.id?.startsWith('deepseek/'))
        ?.map((model: any) => model.id)
        ?.filter(Boolean) || [];
      
      if (deepseekModels.length > 0) {
        availableModelsCache = deepseekModels;
        console.log('Found available DeepSeek models:', deepseekModels);
        // Prioritize the user's specified model
        const userModel = PRIMARY_MODEL;
        if (deepseekModels.includes(userModel)) {
          return [userModel, ...deepseekModels.filter((m: string) => m !== userModel)];
        }
        return deepseekModels;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch available models from OpenRouter:', error);
  }

  // Return default models if fetch fails
  return MODEL_VARIANTS;
}

async function tryModel(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // Filter out empty messages and ensure proper format
  const cleanMessages = messages
    .filter(msg => msg.content && msg.content.trim().length > 0)
    .map(msg => ({
      role: msg.role,
      content: String(msg.content).trim(),
    }));

  if (cleanMessages.length === 0) {
    throw new Error('No valid messages to send');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'JARVIS Chat',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: cleanMessages,
    }),
  });

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    const text = await response.text();
    console.error(`Failed to parse JSON response for model ${model}:`, text);
    throw new Error(`Invalid response from API: ${response.status} ${response.statusText}`);
  }

  // Check for errors in response (even if status is OK)
  if (data.error) {
    console.error(`OpenRouter API Error for model ${model}:`, {
      status: response.status,
      statusText: response.statusText,
      error: data.error,
      fullResponse: data,
    });
    
    const errorMessage = 
      data.error?.message || 
      data.error?.type ||
      data.message ||
      'Provider returned an error';
    
    throw new Error(errorMessage);
  }

  if (!response.ok) {
    // Log full error for debugging
    console.error(`OpenRouter API Error for model ${model}:`, {
      status: response.status,
      statusText: response.statusText,
      error: data.error || data,
      fullResponse: data,
    });
    
    // Extract more detailed error message
    const errorMessage = 
      data.error?.message || 
      data.error?.type ||
      data.message ||
      `API request failed with status ${response.status}`;
    
    throw new Error(errorMessage);
  }
  
  // Check for valid response structure
  if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0];
    if (choice.message && choice.message.content) {
      const content = String(choice.message.content).trim();
      if (content.length > 0) {
        return content;
      }
    }
  }

  // Log unexpected response format
  console.error('Unexpected response format:', data);
  throw new Error('Unexpected response format from API - no valid content in response');
}

export async function sendMessageToOpenRouter(
  previousMessages: ChatMessage[],
  userMessage: string
): Promise<string> {
  // Filter out the initial greeting and format messages properly
  // Only include actual conversation messages (skip the initial "Hello!" message)
  const conversationMessages = previousMessages
    .filter(msg => {
      // Skip the initial greeting message
      const isInitialGreeting = 
        msg.role === 'assistant' && 
        (msg.content.toLowerCase().includes('hello') || 
         msg.content.toLowerCase().includes('how can i help'));
      return !isInitialGreeting;
    })
    .map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

  const messages = [
    ...conversationMessages,
    {
      role: 'user' as const,
      content: userMessage.trim(),
    },
  ];

  // Get available models (try to fetch from API, fallback to defaults)
  let modelsToTry = MODEL_VARIANTS;
  try {
    const availableModels = await getAvailableDeepSeekModels();
    if (availableModels.length > 0) {
      modelsToTry = availableModels;
    }
  } catch (error) {
    console.warn('Using default model list:', error);
  }

  // Try model variants until one works
  let lastError: Error | null = null;
  let triedModels: string[] = [];
  
  for (const model of modelsToTry) {
    triedModels.push(model);
    try {
      console.log(`Trying model: ${model}`);
      const result = await tryModel(model, messages);
      console.log(`Success with model: ${model}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message.toLowerCase();
      
      console.warn(`Model ${model} failed:`, lastError.message);
      
      // If it's an invalid model ID error or no endpoints found, try next variant
      if (
        errorMsg.includes('not a valid model id') || 
        errorMsg.includes('invalid model') ||
        errorMsg.includes('no endpoints found') ||
        errorMsg.includes('endpoint not found')
      ) {
        continue; // Try next variant
      }
      
      // For provider errors, also try next model (might be temporary issue)
      if (errorMsg.includes('provider returned error') || errorMsg.includes('provider error')) {
        console.warn(`Provider error with ${model}, trying next model...`);
        continue; // Try next model
      }
      
      // For other critical errors, throw immediately
      if (!errorMsg.includes('not a valid model') && !errorMsg.includes('provider')) {
        throw lastError;
      }
    }
  }

  // If all variants failed
  throw new Error(
    `All models failed. Tried: ${triedModels.join(', ')}. ` +
    `Last error: ${lastError?.message || 'Unknown error'}. ` +
    `Please check available models at https://openrouter.ai/models`
  );
}

