import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCustomerOrders, updateCustomerProfile } from '../utils/storage';
import api from '../utils/api';
import { statusBadgeClass, statusLabel } from '../utils/orderStatus';
import {
  User,
  Package,
  LogOut,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Phone,
  Mail,
  Navigation,
  Clock,
  ShieldCheck,
  X
} from 'lucide-react';
import './CustomerProfile.css';

export default function CustomerProfile({ loggedInCustomer, onCustomerUpdate, onLogout, onOpenLogin }) {
  const [activeTab, setActiveTab] = useState('orders');

  // Orders state
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('Changed my mind');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Addresses state
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressFormData, setAddressFormData] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postcode: '',
    country: 'India',
    isDefault: false
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState(null);
  const [addressSuccess, setAddressSuccess] = useState(null);

  // Profile details state
  const [profileName, setProfileName] = useState(loggedInCustomer?.name || '');
  const [profilePhone, setProfilePhone] = useState(loggedInCustomer?.phone || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Sync profile form when customer changes
  useEffect(() => {
    if (loggedInCustomer) {
      setProfileName(loggedInCustomer.name || '');
      setProfilePhone(loggedInCustomer.phone || '');
    }
  }, [loggedInCustomer]);

  // Load orders from server (with storage fallback)
  useEffect(() => {
    let cancelled = false;
    if (!loggedInCustomer) return () => {};

    (async () => {
      setLoadingOrders(true);
      try {
        const res = await api.getOrders({}, 'customer');
        if (!cancelled && res?.orders) {
          setOrders(res.orders);
        } else if (!cancelled) {
          setOrders(getCustomerOrders(loggedInCustomer.email));
        }
      } catch {
        if (!cancelled) {
          setOrders(getCustomerOrders(loggedInCustomer.email));
        }
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    })();

    return () => { cancelled = true; };
  }, [loggedInCustomer]);

  // Load addresses from server
  useEffect(() => {
    let cancelled = false;
    if (!loggedInCustomer) return () => {};

    (async () => {
      setLoadingAddresses(true);
      try {
        const res = await api.getUserAddresses();
        if (!cancelled && res?.addresses) {
          setAddresses(res.addresses);
        }
      } catch {
        // Degrade gracefully if offline
      } finally {
        if (!cancelled) setLoadingAddresses(false);
      }
    })();

    return () => { cancelled = true; };
  }, [loggedInCustomer]);

  // Handle Order Cancellation
  const handleOpenCancelModal = (order) => {
    setCancellingOrder(order);
    setCancelReason('Changed my mind');
    setCancelError(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingOrder) return;
    setCancelSubmitting(true);
    setCancelError(null);

    try {
      const res = await api.cancelCustomerOrder(cancellingOrder.id, cancelReason);
      if (res?.success) {
        // Update local orders list
        setOrders(prev => prev.map(o => o.id === cancellingOrder.id ? { ...o, status: 'Cancelled' } : o));
        setCancellingOrder(null);
      } else {
        setCancelError(res?.error || 'Unable to cancel order');
      }
    } catch (err) {
      setCancelError(err.message || 'Unable to cancel order right now. Please try again.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Handle Address Management
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressFormData({
      name: loggedInCustomer?.name || '',
      phone: loggedInCustomer?.phone || '',
      street: '',
      city: '',
      state: '',
      postcode: '',
      country: 'India',
      isDefault: addresses.length === 0
    });
    setAddressError(null);
    setAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setAddressFormData({
      name: addr.name || '',
      phone: addr.phone || '',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      postcode: addr.postcode || '',
      country: addr.country || 'India',
      isDefault: Boolean(addr.isDefault)
    });
    setAddressError(null);
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addressFormData.name || !addressFormData.street || !addressFormData.city || !addressFormData.state || !addressFormData.postcode) {
      setAddressError('Please fill in all required fields (Name, Street, City, State, PIN code).');
      return;
    }

    setAddressSaving(true);
    setAddressError(null);

    try {
      if (editingAddressId) {
        const res = await api.updateUserAddress(editingAddressId, addressFormData);
        if (res?.success && res.address) {
          setAddresses(prev => {
            const next = prev.map(a => a.id === editingAddressId ? res.address : (res.address.isDefault ? { ...a, isDefault: false } : a));
            return next;
          });
          setAddressSuccess('Address updated successfully');
          setAddressModalOpen(false);
        } else {
          setAddressError(res?.error || 'Could not update address');
        }
      } else {
        const res = await api.addUserAddress(addressFormData);
        if (res?.success && res.address) {
          setAddresses(prev => {
            const next = res.address.isDefault ? prev.map(a => ({ ...a, isDefault: false })) : [...prev];
            return [res.address, ...next];
          });
          setAddressSuccess('Address added successfully');
          setAddressModalOpen(false);
        } else {
          setAddressError(res?.error || 'Could not add address');
        }
      }
    } catch (err) {
      setAddressError(err.message || 'Unable to save address. Please try again.');
    } finally {
      setAddressSaving(false);
      setTimeout(() => setAddressSuccess(null), 3000);
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm('Are you sure you want to delete this delivery address?')) return;
    try {
      await api.deleteUserAddress(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
      setAddressSuccess('Address removed successfully');
      setTimeout(() => setAddressSuccess(null), 3000);
    } catch (err) {
      setAddressError(err.message || 'Could not delete address');
      setTimeout(() => setAddressError(null), 3500);
    }
  };

  const handleSetDefaultAddress = async (id) => {
    try {
      await api.setDefaultUserAddress(id);
      setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
      setAddressSuccess('Default delivery address updated');
      setTimeout(() => setAddressSuccess(null), 3000);
    } catch (err) {
      setAddressError(err.message || 'Could not set default address');
      setTimeout(() => setAddressError(null), 3500);
    }
  };

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileError('Full name is required');
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    setProfileMsg(null);

    try {
      const res = await api.updateUserProfile({ name: profileName.trim(), phone: profilePhone.trim() });
      if (res?.success && res.user) {
        const updated = updateCustomerProfile({ name: res.user.name, phone: res.user.phone });
        if (onCustomerUpdate) onCustomerUpdate(updated || res.user);
        setProfileMsg('Profile updated successfully!');
      } else {
        setProfileError(res?.error || 'Could not update profile');
      }
    } catch (err) {
      setProfileError(err.message || 'Unable to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMsg(null), 3500);
    }
  };

  // Handle Password Update
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMsg(null);

    if (!currentPassword || !newPassword) {
      setPasswordError('Please enter both current and new password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await api.updateUserPassword({ currentPassword, newPassword });
      if (res?.success) {
        setPasswordMsg('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res?.error || 'Could not update password');
      }
    } catch (err) {
      setPasswordError(err.message || 'Unable to update password. Please check your current password.');
    } finally {
      setPasswordSaving(false);
      setTimeout(() => setPasswordMsg(null), 4000);
    }
  };

  if (!loggedInCustomer) {
    return (
      <div className="customer-profile-page container">
        <div className="profile-header">
          <h1>My Account</h1>
          <p>Sign in to view your orders, saved addresses, and profile details in one place.</p>
        </div>
        <div className="no-orders">
          <User size={48} color="#cbd5e1" />
          <p>You are not signed in yet.</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn-place-order" style={{ display: 'inline-block', border: 'none', cursor: 'pointer' }} onClick={() => onOpenLogin?.()}>
              Sign in
            </button>
            <Link to="/shop" style={{ display: 'inline-block', padding: '12px 24px', border: '1px solid #e2e8f0', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, color: '#334155' }}>
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-profile-page container">
      <div className="profile-header">
        <h1>My Account</h1>
        <p>Welcome back, <strong>{loggedInCustomer.name}</strong>! Manage your orders, delivery addresses, and personal details.</p>
      </div>

      <div className="profile-layout">
        {/* Sidebar */}
        <aside className="profile-sidebar">
          <div className="profile-user-card">
            <div className="avatar">
              <User size={32} color="#fff" />
            </div>
            <div className="profile-user-info">
              <h3>{loggedInCustomer.name}</h3>
              <p className="profile-email">{loggedInCustomer.email}</p>
              {loggedInCustomer.phone && (
                <p className="profile-phone"><Phone size={13} style={{ display: 'inline', marginRight: 4 }} />{loggedInCustomer.phone}</p>
              )}
              <div className="profile-badge">
                <ShieldCheck size={14} color="#16a34a" /> Verified Customer
              </div>
            </div>
          </div>

          <nav className="profile-nav">
            <button 
              type="button"
              className={activeTab === 'orders' ? 'active' : ''} 
              onClick={() => setActiveTab('orders')}
            >
              <Package size={18} /> My Orders ({orders.length})
            </button>
            <button 
              type="button"
              className={activeTab === 'addresses' ? 'active' : ''} 
              onClick={() => setActiveTab('addresses')}
            >
              <MapPin size={18} /> Saved Addresses ({addresses.length})
            </button>
            <button 
              type="button"
              className={activeTab === 'details' ? 'active' : ''} 
              onClick={() => setActiveTab('details')}
            >
              <User size={18} /> Profile & Security
            </button>
            <button type="button" className="logout-btn" onClick={onLogout}>
              <LogOut size={18} /> Logout
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="profile-content">
          {/* TAB 1: ORDERS */}
          {activeTab === 'orders' && (
            <div className="orders-section">
              <div className="section-toolbar">
                <h2>Order History</h2>
                <div className="toolbar-actions">
                  <Link to="/orders" className="toolbar-link">
                    Full Order History
                  </Link>
                  <Link to="/shop" className="toolbar-link primary">
                    + Continue Shopping
                  </Link>
                </div>
              </div>

              {loadingOrders ? (
                <div className="loading-state">
                  <Clock size={32} className="spin-icon" />
                  <p>Loading your orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="no-orders">
                  <Package size={48} color="#cbd5e1" />
                  <p>You haven't placed any orders yet.</p>
                  <Link to="/shop" className="btn-place-order" style={{ display: 'inline-block', marginTop: '15px', textDecoration: 'none' }}>
                    Browse Products
                  </Link>
                </div>
              ) : (
                <div className="orders-list">
                  {orders.map((order) => {
                    const statusStr = (order.status || 'Processing').toLowerCase();
                    const isCancellable = statusStr === 'processing' || statusStr === 'pending';

                    return (
                      <div className="order-card" key={order.id}>
                        <div className="order-card-header">
                          <div>
                            <Link to={`/orders/${order.id}`} className="order-id" style={{ textDecoration: 'none' }}>
                              Order #{order.orderNumber || order.id}
                            </Link>
                            <span className="order-date">
                              {order.date || order.createdAt ? new Date(order.date || order.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <span className={statusBadgeClass(order.status)}>
                            {statusLabel(order.status)}
                          </span>
                        </div>

                        <div className="order-items">
                          {(order.items || []).map((item, idx) => (
                            <div className="order-item" key={idx}>
                              <img
                                src={item.image || '/placeholder.png'}
                                alt={item.title || item.name}
                                onError={(e) => { e.currentTarget.src = '/placeholder.png'; }}
                              />
                              <div className="item-details">
                                <h4>{item.title || item.name}</h4>
                                <p>Qty: {item.quantity} {item.variant ? `(${item.variant})` : ''}</p>
                                <span className="vendor-tag">
                                  Seller: {item.soldBy || item.vendorName || item.seller || 'Direct'}
                                </span>
                              </div>
                              <div className="item-price">
                                ₹{((parseFloat(String(item.price).replace(/[^0-9.-]+/g, '')) || 0) * (item.quantity || 1)).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {order.shippingAddress && (
                          <div className="order-address-bar">
                            <strong>📍 Delivery Address: </strong> 
                            {typeof order.shippingAddress === 'object'
                              ? `${order.shippingAddress.street || ''}, ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} - ${order.shippingAddress.postcode || ''}`
                              : String(order.shippingAddress)}
                          </div>
                        )}

                        <div className="order-footer">
                          <div className="footer-left">
                            <span className="total-label">
                              Payment: <strong style={{ textTransform: 'uppercase' }}>{order.paymentMethod || 'COD'}</strong>
                            </span>
                            <div className="total-wrap">
                              <span className="total-label">Total:</span>
                              <span className="total-amount">₹{(Number(order.totalAmount ?? order.total) || 0).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="footer-actions">
                            <Link to={`/track-order?orderId=${encodeURIComponent(order.id)}`} className="btn-secondary-sm">
                              <Navigation size={14} /> Track Order
                            </Link>
                            {isCancellable && (
                              <button 
                                type="button" 
                                className="btn-cancel-sm"
                                onClick={() => handleOpenCancelModal(order)}
                              >
                                Cancel Order
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADDRESS MANAGEMENT */}
          {activeTab === 'addresses' && (
            <div className="addresses-section">
              <div className="section-toolbar">
                <div>
                  <h2>Saved Delivery Addresses</h2>
                  <p className="section-subtext">Manage your shipping destinations for faster checkout.</p>
                </div>
                <button type="button" className="btn-primary-sm" onClick={handleOpenAddAddress}>
                  <Plus size={16} /> Add New Address
                </button>
              </div>

              {addressSuccess && (
                <div className="alert-banner success">
                  <CheckCircle2 size={18} /> {addressSuccess}
                </div>
              )}
              {addressError && (
                <div className="alert-banner error">
                  <AlertCircle size={18} /> {addressError}
                </div>
              )}

              {loadingAddresses ? (
                <div className="loading-state">
                  <Clock size={32} className="spin-icon" />
                  <p>Loading addresses...</p>
                </div>
              ) : addresses.length === 0 ? (
                <div className="no-orders">
                  <MapPin size={48} color="#cbd5e1" />
                  <p>You have no saved addresses yet.</p>
                  <button type="button" className="btn-place-order" style={{ marginTop: '15px' }} onClick={handleOpenAddAddress}>
                    + Add Your First Address
                  </button>
                </div>
              ) : (
                <div className="address-grid">
                  {addresses.map((addr) => (
                    <div className={`address-card ${addr.isDefault ? 'is-default' : ''}`} key={addr.id}>
                      {addr.isDefault && (
                        <div className="default-pill">
                          <CheckCircle2 size={13} /> Default Delivery Address
                        </div>
                      )}
                      <div className="address-body">
                        <h4 className="address-name">{addr.name}</h4>
                        {addr.phone && (
                          <p className="address-phone"><Phone size={13} /> {addr.phone}</p>
                        )}
                        <p className="address-text">
                          {addr.street}<br />
                          {addr.city}, {addr.state} - {addr.postcode}<br />
                          {addr.country || 'India'}
                        </p>
                      </div>
                      <div className="address-actions">
                        {!addr.isDefault && (
                          <button 
                            type="button" 
                            className="btn-text-action"
                            onClick={() => handleSetDefaultAddress(addr.id)}
                          >
                            Set as Default
                          </button>
                        )}
                        <button 
                          type="button" 
                          className="btn-icon-action" 
                          title="Edit Address"
                          onClick={() => handleOpenEditAddress(addr)}
                        >
                          <Edit2 size={15} /> Edit
                        </button>
                        <button 
                          type="button" 
                          className="btn-icon-action delete" 
                          title="Delete Address"
                          onClick={() => handleDeleteAddress(addr.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PERSONAL DETAILS & SECURITY */}
          {activeTab === 'details' && (
            <div className="settings-section">
              <div className="settings-box">
                <h2>Personal Details</h2>
                <p className="section-subtext">Update your personal contact details.</p>

                {profileMsg && (
                  <div className="alert-banner success">
                    <CheckCircle2 size={18} /> {profileMsg}
                  </div>
                )}
                {profileError && (
                  <div className="alert-banner error">
                    <AlertCircle size={18} /> {profileError}
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="profile-form">
                  <div className="form-group">
                    <label htmlFor="profileName">Full Name *</label>
                    <div className="input-wrap">
                      <User size={16} className="input-icon" />
                      <input 
                        id="profileName"
                        type="text" 
                        value={profileName} 
                        onChange={(e) => setProfileName(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="profileEmail">Email Address</label>
                    <div className="input-wrap">
                      <Mail size={16} className="input-icon" />
                      <input 
                        id="profileEmail"
                        type="email" 
                        value={loggedInCustomer.email} 
                        disabled 
                        className="disabled-input"
                      />
                    </div>
                    <small className="field-hint">Email address cannot be changed as it is your account identifier.</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="profilePhone">Phone Number</label>
                    <div className="input-wrap">
                      <Phone size={16} className="input-icon" />
                      <input 
                        id="profilePhone"
                        type="tel" 
                        placeholder="e.g. +91 9876543210"
                        value={profilePhone} 
                        onChange={(e) => setProfilePhone(e.target.value)} 
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-save-profile" disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </form>
              </div>

              {/* Password change box */}
              <div className="settings-box" style={{ marginTop: '30px' }}>
                <h2>Security & Password</h2>
                <p className="section-subtext">Ensure your account is protected with a secure password.</p>

                {passwordMsg && (
                  <div className="alert-banner success">
                    <CheckCircle2 size={18} /> {passwordMsg}
                  </div>
                )}
                {passwordError && (
                  <div className="alert-banner error">
                    <AlertCircle size={18} /> {passwordError}
                  </div>
                )}

                <form onSubmit={handleSavePassword} className="profile-form">
                  <div className="form-group">
                    <label htmlFor="currentPassword">Current Password *</label>
                    <div className="input-wrap">
                      <Lock size={16} className="input-icon" />
                      <input 
                        id="currentPassword"
                        type="password" 
                        value={currentPassword} 
                        onChange={(e) => setCurrentPassword(e.target.value)} 
                        placeholder="Enter current password"
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="newPassword">New Password *</label>
                    <div className="input-wrap">
                      <Lock size={16} className="input-icon" />
                      <input 
                        id="newPassword"
                        type="password" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        placeholder="At least 8 characters"
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm New Password *</label>
                    <div className="input-wrap">
                      <Lock size={16} className="input-icon" />
                      <input 
                        id="confirmPassword"
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="Re-enter new password"
                        required 
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-save-profile" disabled={passwordSaving}>
                    {passwordSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD / EDIT ADDRESS */}
      {addressModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>{editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address'}</h3>
              <button type="button" className="close-btn" onClick={() => setAddressModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {addressError && (
              <div className="alert-banner error" style={{ margin: '15px 20px 0' }}>
                <AlertCircle size={18} /> {addressError}
              </div>
            )}

            <form onSubmit={handleSaveAddress} className="address-modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="addrName">Full Name *</label>
                  <input 
                    id="addrName"
                    type="text" 
                    value={addressFormData.name} 
                    onChange={(e) => setAddressFormData({ ...addressFormData, name: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="addrPhone">Phone Number *</label>
                  <input 
                    id="addrPhone"
                    type="tel" 
                    value={addressFormData.phone} 
                    onChange={(e) => setAddressFormData({ ...addressFormData, phone: e.target.value })} 
                    placeholder="10-digit mobile"
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="addrStreet">Street Address / House No. / Area *</label>
                <input 
                  id="addrStreet"
                  type="text" 
                  value={addressFormData.street} 
                  onChange={(e) => setAddressFormData({ ...addressFormData, street: e.target.value })} 
                  placeholder="e.g. 12/B, Green Garden Apartments"
                  required 
                />
              </div>

              <div className="form-row three-col">
                <div className="form-group">
                  <label htmlFor="addrCity">City *</label>
                  <input 
                    id="addrCity"
                    type="text" 
                    value={addressFormData.city} 
                    onChange={(e) => setAddressFormData({ ...addressFormData, city: e.target.value })} 
                    placeholder="e.g. Chennai"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="addrState">State *</label>
                  <input 
                    id="addrState"
                    type="text" 
                    value={addressFormData.state} 
                    onChange={(e) => setAddressFormData({ ...addressFormData, state: e.target.value })} 
                    placeholder="e.g. Tamil Nadu"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="addrPostcode">PIN Code *</label>
                  <input 
                    id="addrPostcode"
                    type="text" 
                    value={addressFormData.postcode} 
                    onChange={(e) => setAddressFormData({ ...addressFormData, postcode: e.target.value })} 
                    placeholder="e.g. 600001"
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="addrCountry">Country</label>
                <input 
                  id="addrCountry"
                  type="text" 
                  value={addressFormData.country} 
                  onChange={(e) => setAddressFormData({ ...addressFormData, country: e.target.value })} 
                />
              </div>

              <div className="checkbox-group">
                <input 
                  id="addrDefault"
                  type="checkbox" 
                  checked={addressFormData.isDefault} 
                  onChange={(e) => setAddressFormData({ ...addressFormData, isDefault: e.target.checked })} 
                />
                <label htmlFor="addrDefault">Make this my default shipping address</label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setAddressModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-save" disabled={addressSaving}>
                  {addressSaving ? 'Saving...' : (editingAddressId ? 'Save Changes' : 'Add Address')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ORDER CANCELLATION CONFIRMATION */}
      {cancellingOrder && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Cancel Order #{cancellingOrder.orderNumber || cancellingOrder.id}</h3>
              <button type="button" className="close-btn" onClick={() => setCancellingOrder(null)}>
                <X size={20} />
              </button>
            </div>

            {cancelError && (
              <div className="alert-banner error" style={{ margin: '15px 20px 0' }}>
                <AlertCircle size={18} /> {cancelError}
              </div>
            )}

            <div style={{ padding: '20px' }}>
              <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.5 }}>
                Are you sure you want to cancel this order? Once cancelled, this action cannot be undone. If you already made an online payment, a refund request will be initiated.
              </p>

              <div className="form-group" style={{ marginTop: '15px' }}>
                <label htmlFor="cancelReasonSelect" style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Reason for Cancellation</label>
                <select 
                  id="cancelReasonSelect"
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Changed my mind">Changed my mind</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Found a better price elsewhere">Found a better price elsewhere</option>
                  <option value="Incorrect shipping address entered">Incorrect shipping address entered</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-modal-cancel" onClick={() => setCancellingOrder(null)}>
                Keep Order
              </button>
              <button 
                type="button" 
                className="btn-danger-confirm" 
                onClick={handleConfirmCancel}
                disabled={cancelSubmitting}
              >
                {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
