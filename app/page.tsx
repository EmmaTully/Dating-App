export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          BlindMatch SMS 💕
        </h1>
        
        <p className="text-xl text-gray-600 mb-8">
          SMS-native dating where AI learns about you and creates meaningful same-day connections
        </p>
        
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            How it works
          </h2>
          
          <div className="space-y-4 text-left">
            <div className="flex items-start space-x-3">
              <span className="bg-pink-100 text-pink-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">1</span>
              <p className="text-gray-700">Text our number and meet Samantha, your AI matchmaker</p>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="bg-pink-100 text-pink-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">2</span>
              <p className="text-gray-700">Chat naturally - she learns your values and preferences</p>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="bg-pink-100 text-pink-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">3</span>
              <p className="text-gray-700">Get asked daily: "Free for a date tonight?"</p>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="bg-pink-100 text-pink-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">4</span>
              <p className="text-gray-700">Samantha finds compatible matches and proposes specific plans</p>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="bg-pink-100 text-pink-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">5</span>
              <p className="text-gray-700">If both say yes, chat through masked numbers until you meet</p>
            </div>
          </div>
        </div>
        
        <div className="bg-pink-100 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-pink-800 mb-2">
            Ready to start?
          </h3>
          <p className="text-pink-700 mb-4">
            Text "Hi" to get started with Samantha
          </p>
          <div className="bg-white rounded-lg p-4 inline-block">
            <p className="text-2xl font-mono font-bold text-gray-800">
              +1 (555) 123-4567
            </p>
            <p className="text-sm text-gray-600 mt-1">
              (Replace with your actual Twilio number)
            </p>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          <p>Privacy-first • No apps to download • Real connections</p>
          <p className="mt-2">
            <a href="/admin" className="text-blue-600 hover:underline">Admin Dashboard</a>
          </p>
        </div>
      </div>
    </div>
  )
}
