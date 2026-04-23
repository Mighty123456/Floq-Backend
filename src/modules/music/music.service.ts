import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MusicService implements OnModuleInit {
  private spotifyAccessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.getSpotifyToken();
  }

  private async getSpotifyToken() {
    const clientId = this.configService.get('SPOTIFY_CLIENT_ID');
    const clientSecret = this.configService.get('SPOTIFY_CLIENT_SECRET');

    if (!clientId || !clientSecret) return;

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
      console.log('✅ Spotify Access Token acquired');
    } catch (error) {
      console.error('❌ Spotify Auth Error:', error.response?.data || error.message);
    }
  }

  async findAll(query?: string) {
    // If no query, search for trending or recent hits
    const searchQuery = query || 'trending 2024';

    // Refresh token if expired
    if (Date.now() > this.tokenExpiry - 60000) {
      await this.getSpotifyToken();
    }

    if (this.spotifyAccessToken) {
      try {
        const response = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=20`, {
          headers: {
            'Authorization': `Bearer ${this.spotifyAccessToken}`
          }
        });

        return response.data.tracks.items.map(track => ({
          id: track.id,
          title: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          url: track.preview_url, // 30-second preview (can be null for some tracks)
          cover: track.album.images[0]?.url,
          duration: this.formatDuration(track.duration_ms)
        }));
      } catch (error) {
        console.error('Spotify Search Error:', error.response?.data || error.message);
        return this.getFallbackMusic(query);
      }
    }

    return this.getFallbackMusic(query);
  }

  private async getFallbackMusic(query?: string) {
    // Fallback to iTunes API (No key required)
    try {
      const searchTerm = query || 'trending';
      const response = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=20`);
      return response.data.results.map(item => ({
        id: item.trackId.toString(),
        title: item.trackName,
        artist: item.artistName,
        url: item.previewUrl,
        cover: item.artworkUrl100,
        duration: this.formatDuration(item.trackTimeMillis)
      }));
    } catch (e) {
      return [];
    }
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${parseInt(seconds) < 10 ? '0' : ''}${seconds}`;
  }
}
