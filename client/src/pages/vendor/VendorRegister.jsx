import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { addVendor, getVendors } from '../../utils/storage';
import '../admin/AdminLogin.css';

export default function VendorRegister() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Check if email already exists
    const vendors = getVendors();
    if (vendors.some(v => v.email === email)) {
      setError('Email is already registered!');
      return;
    }

    addVendor({
      name,
      email,
      password,
      status: 'pending' // Admin must approve
    });

    setSuccess(true);
    setError('');
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
          
          <button type="submit" className="admin-login-btn">
            Register Account
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#555' }}>
          Already have an account? <Link to="/vendor" style={{ color: '#4caf50', fontWeight: 'bold' }}>Login Here</Link>
        </div>
      </div>
    </div>
  );
}
