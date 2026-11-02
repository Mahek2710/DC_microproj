import { useEffect, useState, useCallback } from 'react'
import {
  Activity, Server, Crown, Database, RefreshCw,
  CheckCircle2, XCircle, Terminal, Trash2, Play,
  Wifi, Clock, Layers
} from 'lucide-react'
import './App.css'

const nodes = [
  { id: 'node1', port: 5001 },
  { id: 'node2', port: 5002 },
  { id: 'node3', port: 5003 },
]

async function request(path, options = {}) {
  const response = await fetch(path, options)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function clusterRequest(endpoint, payload) {
  let lastError

  for (const node of nodes) {
    try {
      const result = await request(`/${node.id}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (result.ok) return result
      lastError = new Error(result.error || 'Request rejected')
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('Cluster unavailable')
}

function App() {
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const [logs, setLogs] = useState([])

  const addLog = (message, type = 'info') => {
    setLogs(prev => [
      { message, type, time: new Date().toLocaleTimeString() },
      ...prev,
    ].slice(0, 8))
  }

  const refreshStatus = useCallback(async () => {
    const data = await Promise.all(
      nodes.map(async node => {
        try {
          const status = await request(`/${node.id}/status`)
          return { ...status, online: true }
        } catch {
          return { node_id: node.id, role: 'down', online: false }
        }
      })
    )

    setStatuses(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshStatus()
    const timer = setInterval(refreshStatus, 2000)
    return () => clearInterval(timer)
  }, [refreshStatus])

  const onlineCount = statuses.filter(n => n.online).length
  const leader = statuses.find(n => n.online && n.role === 'leader')
  const term = Math.max(0, ...statuses.filter(n => n.online).map(n => n.term || 0))
  const commit = Math.max(0, ...statuses.filter(n => n.online).map(n => n.commit_index || 0))

  const operate = async (operation) => {
    if (!key.trim()) {
      setResult('Please enter a key.')
      return
    }

    if (operation === 'SET' && !value.trim()) {
      setResult('Please enter a value.')
      return
    }

    setBusy(true)
    setResult('Processing request...')

    try {
      let response

      if (operation === 'GET') {
        response = await clusterRequest('/read', {
          key: key.trim(),
          consistency: 'linearizable',
        })
        setResult(`${key} = ${JSON.stringify(response.value)}`)
      } else {
        response = await clusterRequest('/write', {
          command: operation === 'SET'
            ? { op: 'SET', key: key.trim(), value: value.trim() }
            : { op: 'DELETE', key: key.trim() },
        })

        setResult(
          operation === 'SET'
            ? `Successfully stored ${key} = ${value} (index ${response.index})`
            : `Successfully deleted ${key} (index ${response.index})`
        )
      }

      addLog(`${operation} ${key} successful`, 'success')
      refreshStatus()
    } catch (error) {
      setResult(`Operation failed: ${error.message}`)
      addLog(`${operation} ${key} failed: ${error.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const store = leader?.store || {}
  const entries = Object.entries(store)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Layers size={23} /></div>
          <div>
            <h1>RAFT<span>FLOW</span></h1>
            <p>DISTRIBUTED KEY-VALUE STORE</p>
          </div>
        </div>

        <div className="connection">
          <span className={`pulse ${onlineCount >= 2 ? 'active' : 'inactive'}`} />
          {onlineCount >= 2 ? 'CLUSTER OPERATIONAL' : 'NO MAJORITY'}
          <button className="refresh" onClick={refreshStatus}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <main className="dashboard">
        <div className="welcome">
          <div>
            <p className="eyebrow">OVERVIEW / CLUSTER</p>
            <h2>Cluster Dashboard</h2>
            <p className="subtitle">Monitor consensus, node health and data replication.</p>
          </div>
          <div className="live-label"><Activity size={15} /> LIVE MONITORING</div>
        </div>

        <section className="stats-grid">
          <Stat icon={<Server />} label="ACTIVE NODES" value={`${onlineCount}/3`} detail="Cluster availability" />
          <Stat icon={<Crown />} label="CURRENT LEADER" value={leader?.node_id || 'None'} detail={leader ? 'Leader elected' : 'Election pending'} />
          <Stat icon={<Activity />} label="CURRENT TERM" value={term} detail="Raft election term" />
          <Stat icon={<Database />} label="COMMIT INDEX" value={commit} detail="Committed log entries" />
        </section>

        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">INFRASTRUCTURE</p>
              <h3>Node status</h3>
            </div>
            <span className="small-muted"><Wifi size={14} /> Auto-refresh: 2s</span>
          </div>

          <div className="nodes-grid">
            {nodes.map((node, index) => {
              const status = statuses[index]
              const isOnline = status?.online
              const isLeader = status?.role === 'leader'

              return (
                <div className={`node-card ${isLeader ? 'leader-card' : ''}`} key={node.id}>
                  <div className="node-top">
                    <div className={`node-icon ${isOnline ? 'online' : 'offline'}`}>
                      {isLeader ? <Crown /> : <Server />}
                    </div>
                    <span className={`status-pill ${isOnline ? isLeader ? 'leader' : 'online-pill' : 'offline-pill'}`}>
                      {isOnline ? isLeader ? 'LEADER' : 'FOLLOWER' : 'OFFLINE'}
                    </span>
                  </div>

                  <h3>{node.id.toUpperCase()}</h3>
                  <p className="node-port">127.0.0.1:{node.port}</p>

                  <div className="node-details">
                    <div><span>Term</span><b>{isOnline ? status.term : '—'}</b></div>
                    <div><span>Commit index</span><b>{isOnline ? status.commit_index : '—'}</b></div>
                    <div><span>Log length</span><b>{isOnline ? status.log_length : '—'}</b></div>
                  </div>

                  <div className="node-footer">
                    {isOnline
                      ? <><CheckCircle2 size={14} /> Connected</>
                      : <><XCircle size={14} /> Connection unavailable</>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="content-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">DATA OPERATIONS</p>
                <h3>Key-value console</h3>
              </div>
              <Database size={19} className="muted-icon" />
            </div>

            <label>KEY</label>
            <input
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Enter key (e.g. colour)"
            />

            <label>VALUE</label>
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Enter value (e.g. blue)"
            />

            <div className="operation-buttons">
              <button disabled={busy} className="btn-primary" onClick={() => operate('SET')}>
                <Play size={15} /> SET
              </button>
              <button disabled={busy} className="btn-secondary" onClick={() => operate('GET')}>
                GET
              </button>
              <button disabled={busy} className="btn-danger" onClick={() => operate('DELETE')}>
                <Trash2 size={15} /> DELETE
              </button>
            </div>

            {result && <div className="result-box">{result}</div>}

            <div className="store-heading">
              <span>LEADER KEY-VALUE STORE</span>
              <span>{entries.length} ENTRIES</span>
            </div>

            <div className="store-list">
              {entries.length ? entries.map(([k, v]) => (
                <div className="store-entry" key={k}>
                  <code>{k}</code>
                  <b>{String(v)}</b>
                </div>
              )) : <p className="empty">No committed entries visible on leader.</p>}
            </div>
          </section>

          <section className="panel activity-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SYSTEM EVENTS</p>
                <h3>Activity log</h3>
              </div>
              <Terminal size={19} className="muted-icon" />
            </div>

            <div className="logs">
              {logs.length ? logs.map((log, i) => (
                <div className="log-entry" key={i}>
                  <span className={`log-dot ${log.type}`} />
                  <div>
                    <p>{log.message}</p>
                    <span>{log.time}</span>
                  </div>
                </div>
              )) : <p className="empty">No operations yet. Try a SET or GET request.</p>}
            </div>

            <div className="consensus-box">
              <div className="consensus-title">
                <Activity size={16} /> CONSENSUS STATUS
              </div>
              <div className="consensus-nodes">
                {nodes.map((node, i) => (
                  <span key={node.id} className={statuses[i]?.online ? 'up' : 'down'} />
                ))}
              </div>
              <p>{onlineCount >= 2 ? 'Majority available. Cluster can make progress.' : 'Majority unavailable. Writes cannot safely commit.'}</p>
            </div>
          </section>
        </div>

        <footer>
          <span>RAFTFLOW · DISTRIBUTED SYSTEMS PROJECT</span>
          <span><Clock size={13} /> {loading ? 'Connecting...' : 'Monitoring active'}</span>
        </footer>
      </main>
    </div>
  )
}

function Stat({ icon, label, value, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <h3>{value}</h3>
      <p>{detail}</p>
    </div>
  )
}

export default App