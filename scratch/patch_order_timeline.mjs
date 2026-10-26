import fs from 'fs';

// 1. OrderDetails.jsx
let od = fs.readFileSync('client/src/pages/OrderDetails.jsx', 'utf8');

od = od.replace(
  "  statusBadgeClass,\n  getTimeline,",
  "  statusBadgeClass,\n  statusLabel,\n  getTimeline,"
);

od = od.replace(
  `<span className={statusBadgeClass(order.status)}>
              {(order.status || 'confirmed').replace(/_/g, ' ')}
            </span>`,
  `<span className={statusBadgeClass(order.status)}>
              {statusLabel(order.status)}
            </span>`
);

od = od.replace(
  `<div className="timeline-body">
                      <h4>{step.label}</h4>
                    </div>`,
  `<div className="timeline-body">
                      <h4>{step.label}</h4>
                      {step.description && <p className="tiny muted">{step.description}</p>}
                    </div>`
);

if (!od.includes('order.status?.toLowerCase() === \'cancelled\'')) {
  od = od.replace(
    `</ul>
            </section>`,
    `</ul>
              {order.status?.toLowerCase() === 'cancelled' && (
                <div className="notice notice-danger" style={{ marginTop: '14px' }}>
                  <strong>Order Cancelled</strong>
                  <p className="tiny">This order was cancelled and items were restored to inventory.</p>
                </div>
              )}
            </section>`
  );
}

fs.writeFileSync('client/src/pages/OrderDetails.jsx', od, 'utf8');
console.log('OrderDetails.jsx updated');

// 2. TrackOrder.jsx
let to = fs.readFileSync('client/src/pages/TrackOrder.jsx', 'utf8');

to = to.replace(
  "  statusBadgeClass,\n  getTimeline,",
  "  statusBadgeClass,\n  statusLabel,\n  getTimeline,"
);

to = to.replace(
  `<span className={statusBadgeClass(result.status)}>
                {(result.status || 'confirmed').replace(/_/g, ' ')}
              </span>`,
  `<span className={statusBadgeClass(result.status)}>
                {statusLabel(result.status)}
              </span>`
);

to = to.replace(
  `<div className="timeline-body">
                    <h4>{step.label}</h4>
                    {step.current && <p>Current status — updates as the seller and courier progress the order.</p>}
                    {step.done && <p>Completed.</p>}
                  </div>`,
  `<div className="timeline-body">
                    <h4>{step.label}</h4>
                    {step.current && <p>{step.description || 'Current stage — in progress.'}</p>}
                    {step.done && <p>Completed.</p>}
                  </div>`
);

fs.writeFileSync('client/src/pages/TrackOrder.jsx', to, 'utf8');
console.log('TrackOrder.jsx updated');
