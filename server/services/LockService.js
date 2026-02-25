/**
 * LockService - Handles TetherSense dual-command lock sequence
 *
 * The TetherSense system requires a two-step unlock process:
 * 1. First Command: Unlock the TetherSense chain
 * 2. Second Command: Unlock the Rear Wheel (after user confirms chain secured)
 */

// In-memory ride sessions for prototype
const activeSessions = new Map();

class LockService {
  get apiBase() {
    return process.env.LINKA_API_BASE_URL || 'https://app.linkalock.com/api/merchant_api';
  }

  // Get authorization headers for LINKA API (Meteor.js auth)
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Auth-Token': process.env.LINKA_ACCESS_TOKEN,
      'X-User-Id':    process.env.LINKA_USER_ID,
      'Origin':       'https://fleetview.linkalock.com',
      'Referer':      'https://fleetview.linkalock.com/',
    };
  }

  /**
   * Simple open: unlock chain and wheel in one step
   * @param {string} bikeId - The bike identifier
   * @param {string} userId - The user's ID
   * @returns {Promise<object>} - Session info with ride active status
   */
  // Build the body required by LINKA for lock/unlock commands
  getCommandBody() {
    return {
      access_token:     process.env.LINKA_LOCK_TOKEN,
      mac_addr:         process.env.LINKA_MAC_ADDR,
      schedule:         true,
      firmware_version: '2.6.15',
      smartkey_mac:     ''
    };
  }

  async openBike(bikeId, userId) {
    try {
      await this.callLinkaAPI('/command_unlock', this.getCommandBody());

      const sessionId = `session-${Date.now()}-${userId}`;
      const session = {
        sessionId,
        bikeId,
        userId,
        chainUnlocked: true,
        wheelUnlocked: true,
        startTime: new Date(),
        status: 'ride_active'
      };

      activeSessions.set(sessionId, session);

      return {
        success: true,
        sessionId,
        bikeId,
        startTime: session.startTime,
        message: 'Bike unlocked! Enjoy your ride.',
        status: 'ride_active'
      };
    } catch (error) {
      console.error('Failed to open bike:', error);
      throw new Error('Failed to unlock bike. Please try again.');
    }
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
      const response = await this.callLinkaAPI('/command_unlock', this.getCommandBody());

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
      const response = await this.callLinkaAPI('/command_unlock', this.getCommandBody());

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
      await this.callLinkaAPI('/command_lock', this.getCommandBody());

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
      const response = await this.callLinkaAPI(`/device_status/${bikeId}`, null);
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
    // Simulate only when no API key is configured
    if (!process.env.LINKA_API_KEY) {
      console.log(`[LINKA API SIMULATION] ${endpoint}`, body);
      return {
        success: true,
        simulated: true,
        timestamp: new Date().toISOString()
      };
    }

    // Production: Make actual API call
    const method = body ? 'POST' : 'GET';
    const url = `${this.apiBase}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(),
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`LINKA API error ${response.status}:`, data);
      throw new Error(`LINKA API error: ${response.status} — ${JSON.stringify(data)}`);
    }

    return data;
  }
}

// Export singleton instance
export const lockService = new LockService();
export { activeSessions };
