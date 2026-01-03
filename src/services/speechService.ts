// Text-to-Speech Service for J.A.R.V.I.S.
// Uses the Web Speech API for browser-native TTS

class SpeechService {
  private synth: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private isEnabled: boolean = true;
  private autoSpeak: boolean = false;
  private voicesLoaded: boolean = false;
  private voicesLoadAttempts: number = 0;
  private maxLoadAttempts: number = 5;

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadPreferredVoice();
  }

  private loadPreferredVoice(): void {
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      
      if (voices.length === 0) {
        this.voicesLoadAttempts++;
        if (this.voicesLoadAttempts < this.maxLoadAttempts) {
          // Retry after a delay
          setTimeout(() => {
            if (!this.voicesLoaded) {
              loadVoices();
            }
          }, 500);
        }
        return;
      }
      
      this.voicesLoaded = true;
      this.voicesLoadAttempts = 0;
      
      // Log all available voices for debugging
      console.log('=== Available TTS Voices ===');
      voices.forEach((v, i) => {
        console.log(`${i}: ${v.name} (${v.lang}) ${v.localService ? '[Local]' : '[Remote]'}`);
      });
      
      // Priority list for natural-sounding female voices
      const preferredVoices = [
        // Microsoft Natural/Neural voices (Windows 11) - Best quality
        voices.find(v => v.name.includes('Microsoft Aria') && v.lang.includes('en-US')),
        voices.find(v => v.name.includes('Microsoft Jenny') && v.lang.includes('en-US')),
        voices.find(v => v.name.includes('Microsoft Sonia') && v.lang.includes('en-GB')),
        voices.find(v => v.name.includes('Microsoft Libby') && v.lang.includes('en-GB')),
        
        // Google Cloud/Chrome voices
        voices.find(v => v.name === 'Google UK English Female'),
        voices.find(v => v.name === 'Google US English'),
        
        // Microsoft standard voices (Windows 10/11)
        voices.find(v => v.name.includes('Microsoft Zira')),
        voices.find(v => v.name.includes('Microsoft Hazel')),
        voices.find(v => v.name.includes('Microsoft Susan')),
        
        // Apple voices (macOS/iOS)
        voices.find(v => v.name === 'Samantha' && v.lang.includes('en')),
        voices.find(v => v.name === 'Karen' && v.lang.includes('en-AU')),
        voices.find(v => v.name === 'Moira' && v.lang.includes('en-IE')),
        voices.find(v => v.name === 'Tessa' && v.lang.includes('en-ZA')),
        voices.find(v => v.name === 'Fiona' && v.lang.includes('en')),
        voices.find(v => v.name === 'Victoria' && v.lang.includes('en')),
        voices.find(v => v.name === 'Serena' && v.lang.includes('en-GB')),
        
        // Edge voices
        voices.find(v => v.name.includes('Natural') && v.name.includes('Female') && v.lang.startsWith('en')),
        
        // Any female-indicating voice
        voices.find(v => v.name.toLowerCase().includes('female') && v.lang.startsWith('en')),
        voices.find(v => v.name.toLowerCase().includes('woman') && v.lang.startsWith('en')),
        
        // British English (often sounds more refined)
        voices.find(v => v.lang === 'en-GB' && !v.name.toLowerCase().includes('male')),
        voices.find(v => v.lang === 'en-GB'),
        
        // US English fallback
        voices.find(v => v.lang === 'en-US' && !v.name.toLowerCase().includes('male')),
        voices.find(v => v.lang === 'en-US'),
        
        // Any English
        voices.find(v => v.lang.startsWith('en')),
        
        // Ultimate fallback
        voices[0],
      ];

      this.preferredVoice = preferredVoices.find(v => v !== undefined) || null;
      
      if (this.preferredVoice) {
        console.log('=== Selected Voice ===');
        console.log(`Name: ${this.preferredVoice.name}`);
        console.log(`Language: ${this.preferredVoice.lang}`);
        console.log(`Local: ${this.preferredVoice.localService}`);
      }
    };

    // Chrome loads voices asynchronously
    if (this.synth.getVoices().length > 0) {
      loadVoices();
    } else {
      // Listen for voiceschanged event
      const voicesChangedHandler = () => {
        loadVoices();
        this.synth.removeEventListener('voiceschanged', voicesChangedHandler);
      };
      this.synth.addEventListener('voiceschanged', voicesChangedHandler);
    }
    
    // Fallback: try again after a short delay
    setTimeout(() => {
      if (!this.voicesLoaded) {
        loadVoices();
      }
    }, 500);
  }

  /**
   * Speak the given text
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isEnabled) {
        resolve();
        return;
      }

      // Cancel any ongoing speech
      this.stop();

      // Clean up the text for better speech
      const cleanText = this.cleanTextForSpeech(text);

      if (!cleanText.trim()) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Configure voice settings
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
      }
      
      utterance.rate = 1.0;      // Normal speed
      utterance.pitch = 1.05;    // Slightly higher for female voice
      utterance.volume = 1.0;    // Full volume

      let resolved = false;

      utterance.onend = () => {
        if (!resolved) {
          resolved = true;
          this.currentUtterance = null;
          resolve();
        }
      };

      utterance.onerror = (event) => {
        if (!resolved) {
          resolved = true;
          this.currentUtterance = null;
          if (event.error !== 'interrupted') {
            console.error('Speech synthesis error:', event.error);
            reject(new Error(event.error));
          } else {
            resolve();
          }
        }
      };

      this.currentUtterance = utterance;
      
      try {
        this.synth.speak(utterance);
      } catch (error) {
        if (!resolved) {
          resolved = true;
          this.currentUtterance = null;
          reject(error);
        }
      }
    });
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    if (this.synth.speaking || this.synth.pending) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synth.speaking || this.synth.pending;
  }

  /**
   * Toggle speech on/off
   */
  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled) {
      this.stop();
    }
    return this.isEnabled;
  }

  /**
   * Enable/disable speech
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  /**
   * Check if speech is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set auto-speak mode
   */
  setAutoSpeak(enabled: boolean): void {
    this.autoSpeak = enabled;
  }

  /**
   * Get auto-speak mode
   */
  getAutoSpeak(): boolean {
    return this.autoSpeak;
  }

  /**
   * Get available voices
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.synth.getVoices();
  }

  /**
   * Get female English voices only
   */
  getFemaleVoices(): SpeechSynthesisVoice[] {
    const voices = this.synth.getVoices();
    const maleNames = ['david', 'james', 'richard', 'mark', 'daniel', 'george', 'oliver', 'guy', 'sean', 'male'];
    
    return voices.filter(v => {
      const isEnglish = v.lang.startsWith('en');
      const nameLower = v.name.toLowerCase();
      const isMale = maleNames.some(male => nameLower.includes(male));
      return isEnglish && !isMale;
    });
  }

  /**
   * Set a specific voice by name
   */
  setVoiceByName(name: string): boolean {
    const voices = this.synth.getVoices();
    const voice = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
    if (voice) {
      this.preferredVoice = voice;
      console.log('Voice changed to:', voice.name);
      return true;
    }
    return false;
  }

  /**
   * Set a specific voice
   */
  setVoice(voice: SpeechSynthesisVoice): void {
    this.preferredVoice = voice;
    console.log('Voice changed to:', voice.name);
  }

  /**
   * Get current voice
   */
  getCurrentVoice(): SpeechSynthesisVoice | null {
    return this.preferredVoice;
  }

  /**
   * Cycle to next available female voice
   */
  nextVoice(): string {
    const femaleVoices = this.getFemaleVoices();
    if (femaleVoices.length === 0) return 'No voices available';
    
    const currentIndex = this.preferredVoice 
      ? femaleVoices.findIndex(v => v.name === this.preferredVoice?.name)
      : -1;
    
    const nextIndex = (currentIndex + 1) % femaleVoices.length;
    this.preferredVoice = femaleVoices[nextIndex];
    
    return this.preferredVoice.name;
  }

  /**
   * Clean text for better speech synthesis
   */
  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/```[\s\S]*?```/g, 'code block omitted')
      .replace(/https?:\/\/[^\s]+/g, 'link')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export a singleton instance
export const speechService = new SpeechService();
export default speechService;
