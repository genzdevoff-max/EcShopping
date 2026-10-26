import fs from 'fs';

let ad = fs.readFileSync('client/src/pages/admin/AdminDashboard.jsx', 'utf8');

// 1. Imports
ad = ad.replace(
  "  ShoppingCart, PackageSearch, ClipboardList, Loader2, Plus, Edit2, Trash2",
  "  ShoppingCart, PackageSearch, ClipboardList, Loader2, Plus, Edit2, Trash2, Video, Film"
);

// 2. State & category image
ad = ad.replace(
  "  const [state, setState] = useState({ loading: true, error: null, vendors: [], products: [], orders: [], users: [], categories: [] });",
  "  const [state, setState] = useState({ loading: true, error: null, vendors: [], products: [], orders: [], users: [], categories: [], videos: [] });"
);

ad = ad.replace(
  "  const [newCatStatus, setNewCatStatus] = useState('active');",
  "  const [newCatStatus, setNewCatStatus] = useState('active');\n  const [newCatImage, setNewCatImage] = useState('');"
);

ad = ad.replace(
  "  const [editCatStatus, setEditCatStatus] = useState('active');",
  `  const [editCatStatus, setEditCatStatus] = useState('active');
  const [editCatImage, setEditCatImage] = useState('');

  /* Video review management form state */
  const [newVidTitle, setNewVidTitle] = useState('');
  const [newVidDesc, setNewVidDesc] = useState('');
  const [newVidUrl, setNewVidUrl] = useState('');
  const [newVidThumb, setNewVidThumb] = useState('');
  const [newVidProduct, setNewVidProduct] = useState('');
  const [newVidOrder, setNewVidOrder] = useState('0');
  const [creatingVid, setCreatingVid] = useState(false);
  const [vidFormMsg, setVidFormMsg] = useState({ type: null, text: '' });`
);

// 3. Update useEffect
ad = ad.replace(
  `        const [vendorRes, productRes, orderRes, userRes, catRes] = await Promise.all([
          api.getVendors(),
          api.getProducts({}, 'admin'),
          api.getOrders({}, 'admin'),
          api.getUsers(),
          api.getCategories({}, 'admin')
        ]);`,
  `        const [vendorRes, productRes, orderRes, userRes, catRes, videoRes] = await Promise.all([
          api.getVendors(),
          api.getProducts({}, 'admin'),
          api.getOrders({}, 'admin'),
          api.getUsers(),
          api.getCategories({}, 'admin'),
          api.getVideos().catch(() => ({ success: true, videos: [] }))
        ]);`
);

ad = ad.replace(
  `          orders: orderRes.orders || [],
          users: userRes.users || [],
          categories: catRes.categories || []
        });`,
  `          orders: orderRes.orders || [],
          users: userRes.users || [],
          categories: catRes.categories || [],
          videos: videoRes?.videos || []
        });`
);

// 4. Update Category Handlers
ad = ad.replace(
  `      const res = await api.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim(),
        status: newCatStatus,
        vendorId: newCatVendor === 'shared' ? null : newCatVendor
      }, 'admin');`,
  `      const res = await api.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim(),
        image: newCatImage.trim() || null,
        status: newCatStatus,
        vendorId: newCatVendor === 'shared' ? null : newCatVendor
      }, 'admin');`
);

ad = ad.replace(
  `        setNewCatName('');
        setNewCatDesc('');
        setNewCatVendor('shared');
        setNewCatStatus('active');`,
  `        setNewCatName('');
        setNewCatDesc('');
        setNewCatImage('');
        setNewCatVendor('shared');
        setNewCatStatus('active');`
);

ad = ad.replace(
  `    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || '');
    setEditCatStatus(cat.status || 'active');`,
  `    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || '');
    setEditCatImage(cat.image || '');
    setEditCatStatus(cat.status || 'active');`
);

ad = ad.replace(
  `      const res = await api.updateCategory(editingCatId, {
        name: editCatName.trim(),
        description: editCatDesc.trim(),
        status: editCatStatus
      }, 'admin');`,
  `      const res = await api.updateCategory(editingCatId, {
        name: editCatName.trim(),
        description: editCatDesc.trim(),
        image: editCatImage.trim() || null,
        status: editCatStatus
      }, 'admin');`
);

// 5. Add Video handlers
const videoHandlers = `
  const handleCreateVideo = async (e) => {
    e.preventDefault();
    if (!newVidTitle.trim() || !newVidUrl.trim() || !newVidProduct) {
      setVidFormMsg({ type: 'error', text: 'Title, Video URL, and attached product are required.' });
      return;
    }
    setCreatingVid(true);
    setVidFormMsg({ type: null, text: '' });
    try {
      const res = await api.createVideo({
        title: newVidTitle.trim(),
        description: newVidDesc.trim(),
        videoUrl: newVidUrl.trim(),
        thumbnailUrl: newVidThumb.trim() || null,
        productId: newVidProduct,
        displayOrder: Number(newVidOrder) || 0
      });
      if (res?.success) {
        setNewVidTitle('');
        setNewVidDesc('');
        setNewVidUrl('');
        setNewVidThumb('');
        setNewVidProduct('');
        setNewVidOrder('0');
        setVidFormMsg({ type: 'success', text: 'Video review added successfully!' });
        setAttempt((n) => n + 1);
        setTimeout(() => setVidFormMsg({ type: null, text: '' }), 3000);
      } else {
        setVidFormMsg({ type: 'error', text: res?.error || 'Failed to add video' });
      }
    } catch (err) {
      setVidFormMsg({ type: 'error', text: err?.message || 'Failed to add video' });
    } finally {
      setCreatingVid(false);
    }
  };

  const handleToggleVideoStatus = async (vid) => {
    const nextStatus = vid.status === 'active' ? 'inactive' : 'active';
    await runRowAction(vid.id, async () => {
      const res = await api.updateVideo(vid.id, { status: nextStatus });
      if (!res?.success) throw new Error(res?.error || 'Failed to update video status');
    }, 'Failed to toggle video status');
  };

  const handleDeleteVideo = async (vidId) => {
    if (!window.confirm('Delete this video review?')) return;
    await runRowAction(vidId, async () => {
      const res = await api.deleteVideo(vidId);
      if (!res?.success) throw new Error(res?.error || 'Failed to delete video');
    }, 'Failed to delete video');
  };
`;

ad = ad.replace(
  "  const filteredCategories = state.categories.filter((cat) => {",
  videoHandlers + "\n  const filteredCategories = state.categories.filter((cat) => {"
);

// 6. Navigation Tabs
ad = ad.replace(
  `            ['vendors', 'Vendors', state.vendors.length],
            ['products', 'Products', state.products.length],
            ['customers', 'Customers', state.users.length]`,
  `            ['vendors', 'Vendors', state.vendors.length],
            ['products', 'Products', state.products.length],
            ['videos', 'Video Reviews', (state.videos || []).length],
            ['customers', 'Customers', state.users.length]`
);

// 7. Header Title
ad = ad.replace(
  `{activeTab === 'customers' && 'Customer accounts'}`,
  `{activeTab === 'customers' && 'Customer accounts'}\n            {activeTab === 'videos' && 'Homepage Shorts & Video Reviews'}`
);

// 8. Add Category Image input field in Creation Form
ad = ad.replace(
  `                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Scope / Owner
                      </label>`,
  `                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Image URL
                      </label>
                      <input
                        type="url"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="https://... (Optional)"
                        value={newCatImage}
                        onChange={(e) => setNewCatImage(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Scope / Owner
                      </label>`
);

// 9. Add Videos Tab Content before customers closing
const videosTabContent = `
            {activeTab === 'videos' && (
              <div className="admin-cat-section-wrap">
                {/* 1. Add Video Review Form */}
                <div className="admin-cat-form-card">
                  <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a' }}>
                    <Plus size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
                    Add Video Review or Short
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                    Active videos appear in the 9:16 vertical reels rail on the homepage, linked to your approved products.
                  </p>

                  {vidFormMsg.text && (
                    <div style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      marginBottom: 14,
                      fontSize: 13,
                      background: vidFormMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                      color: vidFormMsg.type === 'success' ? '#166534' : '#991b1b',
                      border: vidFormMsg.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca'
                    }}>
                      {vidFormMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleCreateVideo} className="admin-cat-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) auto' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Video Title *
                      </label>
                      <input
                        type="text"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="e.g. Traditional A2 Ghee Churning"
                        value={newVidTitle}
                        onChange={(e) => setNewVidTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Video URL (MP4 or YouTube) *
                      </label>
                      <input
                        type="url"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="https://...mp4 or YouTube URL"
                        value={newVidUrl}
                        onChange={(e) => setNewVidUrl(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Thumbnail Poster URL
                      </label>
                      <input
                        type="url"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        placeholder="https://... (Optional for YouTube)"
                        value={newVidThumb}
                        onChange={(e) => setNewVidThumb(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Attached Product *
                      </label>
                      <select
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={newVidProduct}
                        onChange={(e) => setNewVidProduct(e.target.value)}
                        required
                      >
                        <option value="">Select an approved product...</option>
                        {state.products.filter(p => p.status === 'approved').map((p) => (
                          <option key={p.id} value={p.id}>{p.title} (₹{p.price})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Display Order
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="admin-filter-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={newVidOrder}
                        onChange={(e) => setNewVidOrder(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={creatingVid}
                      style={{
                        padding: '9px 18px',
                        background: '#0e5c4a',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {creatingVid ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                      Add Video
                    </button>
                  </form>
                </div>

                {/* 2. Video Reviews Table */}
                <div className="admin-cat-section">
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Thumbnail</th>
                          <th>Title</th>
                          <th>Attached Product</th>
                          <th>Order</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(state.videos || []).map((vid) => (
                          <tr key={vid.id}>
                            <td>
                              <img
                                src={vid.thumbnailUrl || '/placeholder.png'}
                                alt=""
                                style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                                onError={(e) => { e.currentTarget.src = '/placeholder.png'; }}
                              />
                            </td>
                            <td>
                              <strong>{vid.title}</strong>
                              {vid.description && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{vid.description}</p>}
                            </td>
                            <td>
                              {vid.productTitle ? (
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#0e5c4a' }}>
                                  {vid.productTitle} (₹{vid.productPrice})
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>None</span>
                              )}
                            </td>
                            <td>{vid.displayOrder}</td>
                            <td>
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                background: vid.status === 'active' ? '#dcfce7' : '#f1f5f9',
                                color: vid.status === 'active' ? '#166534' : '#64748b'
                              }}>
                                {vid.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="approve-btn"
                                style={{
                                  background: vid.status === 'active' ? '#fef3c7' : '#dcfce7',
                                  color: vid.status === 'active' ? '#92400e' : '#166534',
                                  border: 'none',
                                  padding: '5px 10px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  marginRight: 8,
                                  fontSize: 12,
                                  fontWeight: 600
                                }}
                                disabled={busyId === vid.id}
                                onClick={() => handleToggleVideoStatus(vid)}
                              >
                                {busyId === vid.id ? 'Saving...' : vid.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                className="reject-btn"
                                style={{
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  border: 'none',
                                  padding: '5px 10px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 600
                                }}
                                disabled={busyId === vid.id}
                                onClick={() => handleDeleteVideo(vid.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!state.videos || state.videos.length === 0) && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                              No video reviews or shorts added yet. Use the form above to add your first video!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
`;

ad = ad.replace(
  "{activeTab === 'customers' && (",
  videosTabContent + "\n            {activeTab === 'customers' && ("
);

fs.writeFileSync('client/src/pages/admin/AdminDashboard.jsx', ad, 'utf8');
console.log('AdminDashboard.jsx successfully updated');
