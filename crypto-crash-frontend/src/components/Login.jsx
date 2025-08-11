import React, { useState } from 'react';
import toast from 'react-hot-toast';

const Login = ({ onLogin, onRegister }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // Login
        const { email, password } = formData;
        
        if (!email || !password) {
          toast.error('Please fill in all fields');
          return;
        }

        const result = await onLogin({ email, password });
        if (!result.success) {
          toast.error(result.message);
        }
      } else {
        // Register
        const { email, password, username, confirmPassword } = formData;
        
        if (!email || !password || !username) {
          toast.error('Please fill in all required fields');
          return;
        }

        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          return;
        }

        if (password.length < 6) {
          toast.error('Password must be at least 6 characters');
          return;
        }

        if (username.length < 3) {
          toast.error('Username must be at least 3 characters');
          return;
        }

        const result = await onRegister({ email, password, username });
        if (!result.success) {
          toast.error(result.message);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setFormData({
      email: '',
      password: '',
      username: '',
      confirmPassword: ''
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">CRYPTO CRASH</h1>
          <p className="text-gray-400">The ultimate cryptocurrency crash game</p>
        </div>

        <div className="bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white text-center">
              {isLoginMode ? 'Sign In' : 'Create Account'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginMode && (
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="Enter your password"
                disabled={isLoading}
              />
            </div>

            {!isLoginMode && (
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                isLoginMode ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {isLoginMode ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={toggleMode}
                className="text-purple-400 hover:text-purple-300 font-medium focus:outline-none"
                disabled={isLoading}
              >
                {isLoginMode ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>

          {/* Demo Info */}
          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <h3 className="text-yellow-400 font-semibold mb-2">Demo Mode</h3>
            <p className="text-gray-300 text-sm mb-2">
              This is a demonstration version. You'll receive demo cryptocurrency balances upon registration:
            </p>
            <ul className="text-gray-400 text-xs space-y-1">
              <li>• 0.001 BTC</li>
              <li>• 0.01 ETH</li>
              <li>• 1 LTC, ADA, DOT</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
                