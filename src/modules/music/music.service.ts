import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MusicService implements OnModuleInit {
  private spotifyAccessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    console.log('🎵 MusicService Initializing...');
    await this.getSpotifyToken();
  }

  private async getSpotifyToken() {
    const clientId = this.configService.get('SPOTIFY_CLIENT_ID');
    const clientSecret = this.configService.get('SPOTIFY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.warn('⚠️ Spotify Keys missing in .env. Using fallback only.');
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');

      const response = await axios.post('https://accounts.spotify.com/api/token', params, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.spotifyAccessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      console.log('✅ Spotify Access Token acquired successfully');
    } catch (error) {
      console.error('❌ Spotify Auth Error:', error.response?.data || error.message);
    }
  }

  async findAll(query?: string) {
    const searchQuery = (query && query.trim().length > 0) ? query : 'trending 2024';
    console.log(`🔍 Searching for music: "${searchQuery}"`);

    // Refresh token if expired
    if (this.spotifyAccessToken && Date.now() > this.tokenExpiry - 60000) {
      await this.getSpotifyToken();
    }

    if (this.spotifyAccessToken) {
      try {
        const response = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=20`, {
          headers: { 'Authorization': `Bearer ${this.spotifyAccessToken}` }
        });

        if (response.data.tracks.items.length > 0) {
          return response.data.tracks.items.map(track => ({
            id: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            url: track.preview_url,
            cover: track.album.images[0]?.url,
            duration: this.formatDuration(track.duration_ms)
          }));
        }
      } catch (error) {
        console.error('⚠️ Spotify Search failed, falling back to iTunes:', error.message);
      }
    }

    return this.getFallbackMusic(searchQuery);
  }

  private async getFallbackMusic(query: string) {
    try {
      console.log(`🌐 Calling iTunes fallback for: "${query}"`);
      const response = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`);
      
      const results = response.data.results.map(item => ({
        id: item.trackId.toString(),
        title: item.trackName,
        artist: item.artistName,
        url: item.previewUrl,
        cover: item.artworkUrl100,
        duration: this.formatDuration(item.trackTimeMillis)
      }));
      
      console.log(`✅ Found ${results.length} songs via iTunes`);
      return results;
    } catch (e) {
      console.error('❌ iTunes fallback failed:', e.message);
      return [];
    }
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${parseInt(seconds) < 10 ? '0' : ''}${seconds}`;
  }
}
