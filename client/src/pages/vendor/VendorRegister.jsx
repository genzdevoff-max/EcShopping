import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../../utils/api';
import { addVendor } from '../../utils/storage';
import '../admin/AdminLogin.css';

export default function VendorRegister() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const data = await api.registerVendor({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: ''
      });

      if (data?.success && data.vendor) {
        addVendor(data.vendor);
        setSuccess(true);
        setError('');
      } else {
        setError(data?.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>Registration Successful!</h2>
          <p style={{ color: '#555', marginBottom: '25px', lineHeight: '1.5' }}>
            Your vendor account has been created and is currently <strong>pending approval</strong> from the admin. You will be able to log in once the admin approves your account.
          </p>
          <Link to="/vendor" className="admin-login-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h2>Become a Vendor</h2>
          <p>Register to start selling your products</p>
        </div>
        
        {error && <div className="admin-error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="name">Business / Farm Name</label>
            <input 
              type="text" 
              id="name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Farms"
              required 
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendor@example.com"
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"}
                id="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                required 
              />
              <button 
                type="button" 
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide Password" : "Show Password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <button type="submit" className="admin-login-btn" disabled={loading}>
            {loading ? 'Submitting…' : 'Register Account'}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#555' }}>
          Already have an account? <Link to="/vendor" style={{ color: '#4caf50', fontWeight: 'bold' }}>Login Here</Link>
        </div>
      </div>
    </div>
  );
}
