'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  phone: string
  is_active: boolean
  is_onboarded: boolean
  created_at: string
  profiles: Array<{
    first_name: string
    city: string
    date_of_birth: string
  }>
}

interface Match {
  id: string
  status: string
  match_score: number
  proposed_date: string
  proposed_time: string
  proposed_activity: string
  user1_response: string
  user2_response: string
  created_at: string
  user1: { profiles: Array<{ first_name: string }> }
  user2: { profiles: Array<{ first_name: string }> }
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    onboardedUsers: 0,
    availableTonight: 0,
    activeMatches: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load users
      const usersRes = await fetch('/api/admin/users')
      const usersData = await usersRes.json()
      setUsers(usersData.users || [])
      
      // Load matches
      const matchesRes = await fetch('/api/admin/matches')
      const matchesData = await matchesRes.json()
      setMatches(matchesData.matches || [])
      
      // Load stats
      const statsRes = await fetch('/api/admin/stats')
      const statsData = await statsRes.json()
      setStats(statsData.stats || {})
      
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const runMatchingJob = async () => {
    try {
      const response = await fetch('/api/match/run', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev'}`
        }
      })
      const result = await response.json()
      alert(`Matching job completed: ${result.users_processed} users processed`)
      loadData()
    } catch (error) {
      alert('Error running matching job')
      console.error(error)
    }
  }

  const runInviteJob = async () => {
    try {
      const response = await fetch('/api/invite/run', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'dev'}`
        }
      })
      const result = await response.json()
      alert(`Invite job completed: ${result.users_processed} users processed`)
      loadData()
    } catch (error) {
      alert('Error running invite job')
      console.error(error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">BlindMatch Admin</h1>
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">BlindMatch Admin Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
            <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Onboarded</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.onboardedUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Available Tonight</h3>
            <p className="text-2xl font-bold text-purple-600">{stats.availableTonight}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Matches</h3>
            <p className="text-2xl font-bold text-red-600">{stats.activeMatches}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-8 space-x-4">
          <button
            onClick={runInviteJob}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Run Invite Job
          </button>
          <button
            onClick={runMatchingJob}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Run Matching Job
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Users Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.slice(0, 10).map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.profiles?.[0]?.first_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.is_active && user.is_onboarded 
                            ? 'bg-green-100 text-green-800' 
                            : user.is_active 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active && user.is_onboarded ? 'Active' : user.is_active ? 'Onboarding' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.profiles?.[0]?.city || 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Matches Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Matches</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {matches.slice(0, 10).map((match) => (
                    <tr key={match.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {match.user1?.profiles?.[0]?.first_name || 'User1'} & {match.user2?.profiles?.[0]?.first_name || 'User2'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          match.status === 'accepted' 
                            ? 'bg-green-100 text-green-800' 
                            : match.status === 'proposed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {match.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(match.match_score * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {match.proposed_activity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
