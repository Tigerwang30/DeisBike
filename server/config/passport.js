import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

// In-memory user store for prototype (replace with database in production)
const users = new Map();

export function configurePassport(passport) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  }, (accessToken, refreshToken, profile, done) => {
    // Restrict to brandeis.edu domain
    const email = profile.emails?.[0]?.value || '';
    if (!email.endsWith('@brandeis.edu')) {
      return done(null, false, { message: 'Only Brandeis email addresses are allowed' });
    }

    // Find or create user
    let user = users.get(profile.id);
    if (!user) {
      user = {
        id: profile.id,
        email: email,
        displayName: profile.displayName,
        photo: profile.photos?.[0]?.value,
        hasSignedWaiver: false,
        moodleApproved: false,
        isAdmin: false,
        createdAt: new Date()
      };
      users.set(profile.id, user);
    }

    return done(null, user);
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    const user = users.get(id);
    done(null, user || null);
  });
}

// Export users map for admin operations
export { users };
