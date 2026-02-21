/**
 * LockService - Handles TetherSense dual-command lock sequence
 *
 * The TetherSense system requires a two-step unlock process:
 * 1. First Command: Unlock the TetherSense chain
 * 2. Second Command: Unlock the Rear Wheel (after user confirms chain secured)
 */

const LINKA_API_BASE = process.env.LINKA_API_BASE_URL || 'https://api.linkalock.com/v1';
const API_KEY = process.env.LINKA_API_KEY;
const API_SECRET = process.env.LINKA_API_SECRET;
const ACCESS_TOKEN = process.env.LINKA_ACCESS_TOKEN;
const MERCHANT_KEY = process.env.LINKA_MERCHANT_KEY;

// In-memory ride sessions for prototype
const activeSessions = new Map();

class LockService {
  constructor() {
    this.apiBase = LINKA_API_BASE;
  }

  // Get authorization headers for LINKA API
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN || API_KEY}`,
      'X-API-Key': API_KEY,
      'X-API-Secret': API_SECRET,
      'X-Merchant-Key': MERCHANT_KEY
    };
  }

  /**
   * Step 1: Unlock TetherSense chain
   * @param {string} bikeId - The bike identifier
   * @param {string} userId - The user's ID
   * @returns {Promise<object>} - Session info with chainUnlocked status
   */
  async unlockChain(bikeId, userId) {
    try {
      // In production, this calls the LINKA FleetView API
      // For prototype, we simulate the response
      const response = await this.callLinkaAPI(`/locks/${bikeId}/unlock`, {
        component: 'chain',
        userId: userId
      });

      // Create session to track the two-step process
      const sessionId = `session-${Date.now()}-${userId}`;
      const session = {
        sessionId,
        bikeId,
        userId,
        chainUnlocked: true,
        wheelUnlocked: false,
        startTime: null,
        status: 'chain_unlocked'
      };

      activeSessions.set(sessionId, session);

      return {
        success: true,
        sessionId,
        message: 'Chain unlocked. Please secure the chain and confirm.',
        nextStep: 'confirm_chain_secured'
      };
    } catch (error) {
      console.error('Failed to unlock chain:', error);
      throw new Error('Failed to unlock chain. Please try again.');
    }
  }

  /**
   * Step 2: Unlock rear wheel after chain confirmation
   * @param {string} sessionId - The active session ID
   * @returns {Promise<object>} - Ride started confirmation
   */
  async unlockWheel(sessionId) {
    const session = activeSessions.get(sessionId);

    if (!session) {
      throw new Error('Invalid session. Please start over.');
    }

    if (!session.chainUnlocked) {
      throw new Error('Chain must be unlocked first.');
    }

    try {
      // Call LINKA API to unlock rear wheel
      const response = await this.callLinkaAPI(`/locks/${session.bikeId}/unlock`, {
        component: 'wheel',
        userId: session.userId
      });

      // Update session
      session.wheelUnlocked = true;
      session.startTime = new Date();
      session.status = 'ride_active';
      activeSessions.set(sessionId, session);

      return {
        success: true,
        sessionId,
        bikeId: session.bikeId,
        startTime: session.startTime,
        message: 'Bike unlocked! Enjoy your ride.',
        status: 'ride_active'
      };
    } catch (error) {
      console.error('Failed to unlock wheel:', error);
      throw new Error('Failed to unlock wheel. Please try again.');
    }
  }

  /**
   * Lock the bike (end ride)
   * Can be triggered manually or by webhook when TetherSense chain is plugged back in
   * @param {string} sessionId - The active session ID
   * @returns {Promise<object>} - Ride summary
   */
  async lockBike(sessionId) {
    const session = activeSessions.get(sessionId);

    if (!session) {
      throw new Error('Invalid session.');
    }

    try {
      // Call LINKA API to lock
      await this.callLinkaAPI(`/locks/${session.bikeId}/lock`, {
        userId: session.userId
      });

      const endTime = new Date();
      const duration = session.startTime
        ? Math.round((endTime - session.startTime) / 1000 / 60) // minutes
        : 0;

      // Update session
      session.endTime = endTime;
      session.duration = duration;
      session.status = 'completed';

      // Store completed ride (in production, save to database)
      const rideRecord = { ...session };
      activeSessions.delete(sessionId);

      return {
        success: true,
        rideId: sessionId,
        bikeId: session.bikeId,
        startTime: session.startTime,
        endTime: endTime,
        duration: duration,
        message: `Ride completed. Duration: ${duration} minutes.`
      };
    } catch (error) {
      console.error('Failed to lock bike:', error);
      throw new Error('Failed to lock bike. Please try again.');
    }
  }

  /**
   * Get lock status from LINKA API
   * @param {string} bikeId - The bike identifier
   * @returns {Promise<object>} - Lock status
   */
  async getLockStatus(bikeId) {
    try {
      const response = await this.callLinkaAPI(`/locks/${bikeId}/status`);
      return response;
    } catch (error) {
      console.error('Failed to get lock status:', error);
      // Return simulated status for prototype
      return {
        bikeId,
        chainLocked: true,
        wheelLocked: true,
        batteryLevel: 85,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Get active session for a user
   * @param {string} userId - The user's ID
   * @returns {object|null} - Active session or null
   */
  getActiveSession(userId) {
    for (const [sessionId, session] of activeSessions) {
      if (session.userId === userId && session.status === 'ride_active') {
        return session;
      }
    }
    return null;
  }

  /**
   * Handle webhook from LINKA when TetherSense chain is plugged back in
   * @param {object} payload - Webhook payload
   * @returns {Promise<object>} - Processing result
   */
  async handleWebhook(payload) {
    const { bikeId, event, timestamp } = payload;

    if (event === 'chain_locked') {
      // Find active session for this bike
      for (const [sessionId, session] of activeSessions) {
        if (session.bikeId === bikeId && session.status === 'ride_active') {
          // Auto-end the ride
          return await this.lockBike(sessionId);
        }
      }
    }

    return { success: true, message: 'Webhook processed' };
  }

  /**
   * Make API call to LINKA FleetView
   * In prototype mode, this simulates responses
   */
  async callLinkaAPI(endpoint, body = null) {
    // For prototype/development, simulate API responses
    if (process.env.NODE_ENV === 'development' || !API_KEY) {
      console.log(`[LINKA API SIMULATION] ${endpoint}`, body);
      return {
        success: true,
        simulated: true,
        timestamp: new Date().toISOString()
      };
    }

    // Production: Make actual API call
    const url = `${this.apiBase}${endpoint}`;
    const options = {
      method: body ? 'POST' : 'GET',
      headers: this.getHeaders()
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`LINKA API error: ${response.status}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const lockService = new LockService();
export { activeSessions };
