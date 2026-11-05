import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  X, 
  FolderTree, 
  RefreshCw,
  Power,
  Layers,
  UploadCloud,
  Loader2
} from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/ui/Pagination';
import { DEFAULT_CATEGORY_IMAGE } from '../../data/content';
import { clearCategoriesCache } from '../../data/storefront';
import './CategoryManager.css';

export default function CategoryManager({ vendor }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [image, setImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Floating Toast state (No alert())
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!validTypes.includes(file.type)) {
      showToast('Please select a valid image file (JPEG, PNG, WEBP, AVIF).', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image file size exceeds 10MB limit.', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const res = await api.uploadImage(file, 'vendor');
      if (res?.success && res.url) {
        setImage(res.url);
        showToast('Category image uploaded successfully!', 'success');
      } else {
        showToast(res?.error || 'Failed to upload category image', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch categories from TiDB (vendor token attached by api.js)
  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await api.getCategories({ vendorId: vendor?.id || '' });
      if (data?.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
      } else {
        setCategories([]);
      }
    } catch (err) {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [vendor?.id]);

  // Handle Form Submit (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter a category name', 'error');
      return;
    }

    setSubmitting(true);

    if (editingId) {
      // Update existing category
      try {
        const data = await api.updateCategory(editingId, {
          name: name.trim(),
          description: description.trim(),
          status,
          imageUrl: image.trim() || null
        });

        if (data?.success) {
          clearCategoriesCache();
          showToast(`Category "${name}" updated successfully!`, 'success');
          resetForm();
          fetchCategories();
        } else {
          showToast((data && data.error) || 'Failed to update category', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Failed to update category', 'error');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Create new category
      try {
        const data = await api.createCategory({
          name: name.trim(),
          description: description.trim(),
          status,
          vendorId: vendor?.id || null,
          imageUrl: image.trim() || null
        });

        if (data?.success) {
          clearCategoriesCache();
          showToast(`Category "${name}" created successfully!`, 'success');
          resetForm();
          fetchCategories();
        } else {
          showToast((data && data.error) || 'Failed to create category', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Failed to create category', 'error');
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Start Editing
  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
    setStatus(cat.status || 'active');
    setImage(cat.image || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset / Cancel Form
  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setStatus('active');
    setImage('');
  };

  // Toggle Category Status (Active <-> Inactive)
  const handleToggleStatus = async (cat) => {
    const newStatus = cat.status === 'active' ? 'inactive' : 'active';
    try {
      const data = await api.updateCategory(cat.id, { status: newStatus });

      if (data?.success) {
        showToast(`Category status changed to "${newStatus}"`, 'info');
        fetchCategories();
      } else {
        showToast((data && data.error) || 'Failed to update status', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Delete Category
  const handleDelete = async (cat) => {
    try {
      const data = await api.deleteCategory(cat.id);

      if (data?.success) {
        showToast(`Category "${cat.name}" deleted successfully!`, 'success');
        if (editingId === cat.id) resetForm();
        fetchCategories();
      } else {
        showToast((data && data.error) || 'Failed to delete category', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete category', 'error');
    }
  };

  // Filter Categories by Search
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  const paginatedCategories = filteredCategories.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const activeCount = categories.filter(c => c.status === 'active').length;
  const inactiveCount = categories.filter(c => c.status === 'inactive').length;

  return (
    <div className="cat-manager-root">
      {/* ---------------- FLOATING TOAST NOTIFICATION ---------------- */}
      {toast && (
        <div className="cat-floating-toast-wrap">
          <div className={`cat-toast-item ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={18} className="cat-toast-icon" />}
            {toast.type === 'error' && <AlertCircle size={18} className="cat-toast-icon" />}
            {toast.type === 'info' && <CheckCircle size={18} className="cat-toast-icon" />}
            
            <span className="cat-toast-text">{toast.message}</span>

            <button 
              type="button"
              className="cat-toast-dismiss"
              onClick={() => setToast(null)}
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- COMPACT TOP STATUS BAR ---------------- */}
      <div className="cat-top-bar">
        <div className="cat-top-bar-left">
          <Layers size={20} />
          <span>Category Directory</span>
        </div>

        <div className="cat-top-bar-right">
          <span className="cat-stat-badge total">
            Total: {categories.length}
          </span>
          <span className="cat-stat-badge active">
            <span className="cat-stat-dot"></span>
            Active: {activeCount}
          </span>
          <span className="cat-stat-badge inactive">
            Inactive: {inactiveCount}
          </span>
          <button 
            type="button"
            className="cat-refresh-btn"
            onClick={fetchCategories} 
            title="Refresh from TiDB Cloud"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ---------------- 2-COLUMN SPLIT GRID ---------------- */}
      <div className="cat-split-layout">
        
        {/* ================= LEFT COLUMN: FORM CARD ================= */}
        <div className="cat-form-card">
          <div className="cat-form-header">
            <h3 className="cat-form-title">
              <FolderTree size={18} />
              <span>{editingId ? 'Edit Category' : 'Add New Category'}</span>
            </h3>
            {editingId && (
              <span className="cat-editing-tag">Editing</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="cat-form-body">
            {/* 1. Category Name */}
            <div className="cat-field-group">
              <label htmlFor="cat-name-field" className="cat-field-label">
                <span>Category Name</span>
                <span className="req">*</span>
              </label>
              <input 
                id="cat-name-field"
                type="text" 
                className="cat-text-input" 
                placeholder="e.g. Fresh Vegetables, Pure Honey"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* 2. Category Description (Optional) */}
            <div className="cat-field-group">
              <label htmlFor="cat-desc-field" className="cat-field-label">
                <span>Category Description</span>
                <span className="opt">(optional)</span>
              </label>
              <textarea 
                id="cat-desc-field"
                className="cat-textarea-input" 
                placeholder="Brief description of products in this category..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
            </div>

            {/* 3. Status (Active, Inactive) */}
            <div className="cat-field-group">
              <label htmlFor="cat-status-field" className="cat-field-label">
                <span>Status</span>
                <span className="req">*</span>
              </label>
              <select 
                id="cat-status-field"
                className="cat-select-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                required
              >
                <option value="active">Active (Visible in catalog)</option>
                <option value="inactive">Inactive (Hidden)</option>
              </select>
            </div>

            {/* 4. Category Image */}
            <div className="cat-field-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="cat-field-label" style={{ marginBottom: 0 }}>
                  <span>Category Image</span>
                  <span className="opt">(displayed on storefront)</span>
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage || submitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
                >
                  {uploadingImage ? (
                    <><Loader2 size={12} className="animate-spin" /> Uploading...</>
                  ) : (
                    <><UploadCloud size={12} /> Upload File</>
                  )}
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp,image/avif"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
                disabled={uploadingImage || submitting}
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  className="cat-text-input"
                  placeholder="Paste Image URL or upload file..."
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                />
                {image && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <img
                      src={image}
                      alt="Preview"
                      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #0e5c4a' }}
                      onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setImage('')}
                      title="Clear image"
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="cat-form-buttons">
              <button 
                type="submit" 
                className="cat-btn-submit" 
                disabled={submitting}
              >
                {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
                <span>
                  {submitting 
                    ? 'Saving...' 
                    : editingId 
                      ? 'Update Category' 
                      : 'Add Category'}
                </span>
              </button>

              {editingId && (
                <button 
                  type="button" 
                  className="cat-btn-cancel"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ================= RIGHT COLUMN: TABLE CARD ================= */}
        <div className="cat-table-card">
          {/* Table Header Toolbar */}
          <div className="cat-table-header-toolbar">
            <div className="cat-search-container">
              <Search size={16} className="cat-search-icon-svg" />
              <input 
                type="text" 
                className="cat-search-field" 
                placeholder="Search category by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="cat-count-info">
              Showing <strong>{filteredCategories.length}</strong> {filteredCategories.length === 1 ? 'category' : 'categories'}
            </div>
          </div>

          {/* Table */}
          <div className="cat-table-responsive">
            <table className="cat-grid-table">
              <thead>
                <tr>
                  <th className="cat-col-num">#</th>
                  <th style={{ width: 44, textAlign: 'center' }}>Image</th>
                  <th>Category Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCategories.map((cat, idx) => (
                  <tr key={cat.id}>
                    <td className="cat-col-num">{(page - 1) * pageSize + idx + 1}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', margin: '0 auto', border: '1.5px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={cat.image || DEFAULT_CATEGORY_IMAGE}
                          alt={cat.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            if (e.currentTarget.src !== DEFAULT_CATEGORY_IMAGE) {
                              e.currentTarget.src = DEFAULT_CATEGORY_IMAGE;
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td className="cat-col-name">{cat.name}</td>
                    <td className="cat-col-desc" title={cat.description || ''}>
                      {cat.description || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td>
                      <span className={`cat-status-pill ${cat.status || 'active'}`}>
                        <span className="cat-status-bullet"></span>
                        {cat.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="cat-action-group">
                        {/* Toggle Status */}
                        <button 
                          type="button"
                          className="cat-icon-btn toggle" 
                          title={`Toggle status to ${cat.status === 'active' ? 'Inactive' : 'Active'}`}
                          onClick={() => handleToggleStatus(cat)}
                        >
                          <Power size={14} />
                        </button>

                        {/* Edit */}
                        <button 
                          type="button"
                          className="cat-icon-btn edit" 
                          title="Edit Category"
                          onClick={() => handleEdit(cat)}
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Delete */}
                        <button 
                          type="button"
                          className="cat-icon-btn delete" 
                          title="Delete Category"
                          onClick={() => handleDelete(cat)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <div className="cat-empty-box">
                        <div className="cat-empty-icon-wrap">
                          <FolderTree size={24} />
                        </div>
                        <h4>No Categories Found</h4>
                        <p>
                          {search 
                            ? 'No categories match your search term.' 
                            : 'Start by creating your first category using the form on the left!'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '14px 18px', borderTop: '1px solid #e2e8f0' }}>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filteredCategories.length / pageSize) || 1}
              onPageChange={setPage}
              totalItems={filteredCategories.length}
              pageSize={pageSize}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
