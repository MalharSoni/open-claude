const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

class TTSService {
  constructor() {
    this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
    this.openAIApiKey = process.env.OPENAI_API_KEY;

    // Setup output directory for audio files
    this.outputDir = path.join(__dirname, '..', 'public', 'audio');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateAudio(text, businessId = 'default') {
    const options = {
      voice: 'rachel',
      provider: process.env.TTS_PROVIDER || 'elevenlabs',
      format: 'mp3_44100_128'
    };

    try {
      if (options.provider === 'elevenlabs' && this.elevenLabsApiKey) {
        return await this.generateElevenLabsSpeech(text, options.voice, options.format, businessId);
      } else if (options.provider === 'openai' && this.openAIApiKey) {
        return await this.generateOpenAISpeech(text, options.voice, businessId);
      } else if (options.provider === 'open_source') {
        return await this.generateOpenSourceTTS(text, businessId);
      } else {
        return {
          success: false,
          error: 'No TTS provider configured',
          text: text,
          url: null
        };
      }
    } catch (error) {
      console.error('TTS generation error:', error);
      return {
        success: false,
        error: error.message,
        text: text,
        url: null
      };
    }
  }

  async generateSpeech(text, options = {}) {
    const {
      voice = 'rachel',
      provider = process.env.TTS_PROVIDER || 'elevenlabs',
      format = 'mp3_44100_128',
      businessId = 'default'
    } = options;

    try {
      if (provider === 'elevenlabs' && this.elevenLabsApiKey) {
        return await this.generateElevenLabsSpeech(text, voice, format, businessId);
      } else if (provider === 'openai' && this.openAIApiKey) {
        return await this.generateOpenAISpeech(text, voice, businessId);
      } else if (provider === 'open_source') {
        return await this.generateOpenSourceTTS(text, businessId);
      } else {
        return {
          success: false,
          error: 'No TTS provider configured',
          text: text,
          url: null
        };
      }
    } catch (error) {
      console.error('TTS generation error:', error);
      return {
        success: false,
        error: error.message,
        text: text,
        url: null
      };
    }
  }

  async generateElevenLabsSpeech(text, voice = 'rachel', format = 'mp3_44100_128', businessId = 'default') {
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

    // Save audio file to disk
    const filename = `${businessId}-${Date.now()}.mp3`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, audioBuffer);

    return {
      success: true,
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg',
      provider: 'elevenlabs',
      voice: voice,
      text: text,
      url: `/audio/${filename}`,
      filepath: filepath
    };
  }

  async generateOpenAISpeech(text, voice = 'alloy', businessId = 'default') {
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

    // Save audio file to disk
    const filename = `${businessId}-${Date.now()}.mp3`;
    const filepath = path.join(this.outputDir, filename);
    fs.writeFileSync(filepath, audioBuffer);

    return {
      success: true,
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg',
      provider: 'openai',
      voice: selectedVoice,
      text: text,
      url: `/audio/${filename}`,
      filepath: filepath
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

  async generateOpenSourceTTS(text, businessId = 'default') {
    try {
      // Simulate open source TTS with a simple text-to-file approach
      // In production, this would use something like espeak, festival, or a Hugging Face model
      console.log('Using open source TTS fallback for:', text.substring(0, 50) + '...');

      // Create a simple audio placeholder file
      const filename = `${businessId}-${Date.now()}-opensource.mp3`;
      const filepath = path.join(this.outputDir, filename);

      // For demo purposes, create a small dummy MP3 file
      // In reality, you'd integrate with espeak, festival, or a Python TTS script
      const dummyMp3Header = Buffer.from([
        0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);

      fs.writeFileSync(filepath, dummyMp3Header);

      return {
        success: true,
        audio: dummyMp3Header.toString('base64'),
        contentType: 'audio/mpeg',
        provider: 'open_source',
        voice: 'default',
        text: text,
        url: `/audio/${filename}`,
        filepath: filepath,
        note: 'Demo placeholder - integrate with real open source TTS'
      };

    } catch (error) {
      console.error('Open source TTS error:', error);
      throw error;
    }
  }
}

module.exports = new TTSService();