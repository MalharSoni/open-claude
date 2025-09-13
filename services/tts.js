const fetch = require('node-fetch');

class TTSService {
  constructor() {
    this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
    this.openAIApiKey = process.env.OPENAI_API_KEY;
  }

  async generateSpeech(text, options = {}) {
    const {
      voice = 'rachel',
      provider = process.env.TTS_PROVIDER || 'elevenlabs',
      format = 'mp3_44100_128'
    } = options;

    try {
      if (provider === 'elevenlabs' && this.elevenLabsApiKey) {
        return await this.generateElevenLabsSpeech(text, voice, format);
      } else if (provider === 'openai' && this.openAIApiKey) {
        return await this.generateOpenAISpeech(text, voice);
      } else {
        return {
          success: false,
          error: 'No TTS provider configured',
          text: text
        };
      }
    } catch (error) {
      console.error('TTS generation error:', error);
      return {
        success: false,
        error: error.message,
        text: text
      };
    }
  }

  async generateElevenLabsSpeech(text, voice = 'rachel', format = 'mp3_44100_128') {
    const voiceIds = {
      rachel: '21m00Tcm4TlvDq8ikWAM',
      domi: 'AZnzlk1XvdvUeBnXmlld',
      bella: 'EXAVITQu4vr4xnSDxMaL',
      antoni: 'ErXwobaYiN019PkySvjV',
      josh: 'TxGEqnHWrfWFTfGW9XjX',
      arnold: 'VR6AewLTigWG4xSOukaG'
    };

    const selectedVoiceId = voiceIds[voice] || this.elevenLabsVoiceId;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.elevenLabsApiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        },
        output_format: format
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${error}`);
    }

    const audioBuffer = await response.buffer();

    return {
      success: true,
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg',
      provider: 'elevenlabs',
      voice: voice,
      text: text
    };
  }

  async generateOpenAISpeech(text, voice = 'alloy') {
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'alloy';

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: selectedVoice,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const audioBuffer = await response.buffer();

    return {
      success: true,
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg',
      provider: 'openai',
      voice: selectedVoice,
      text: text
    };
  }

  async streamSpeech(text, onChunk, options = {}) {
    const { provider = process.env.TTS_PROVIDER || 'elevenlabs' } = options;

    if (provider === 'elevenlabs' && this.elevenLabsApiKey) {
      return await this.streamElevenLabsSpeech(text, onChunk, options);
    } else {
      throw new Error('Streaming not supported for this provider');
    }
  }

  async streamElevenLabsSpeech(text, onChunk, options = {}) {
    const { voice = 'rachel' } = options;
    const voiceIds = {
      rachel: '21m00Tcm4TlvDq8ikWAM',
      domi: 'AZnzlk1XvdvUeBnXmlld'
    };

    const selectedVoiceId = voiceIds[voice] || this.elevenLabsVoiceId;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.elevenLabsApiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs streaming error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    let chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      if (onChunk) {
        onChunk(value);
      }
    }

    return Buffer.concat(chunks);
  }
}

module.exports = new TTSService();