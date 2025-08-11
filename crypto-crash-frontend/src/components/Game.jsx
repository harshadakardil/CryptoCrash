import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Game = ({ socket, user, onLogout }) => {
  const [gameState, setGameState] = useState({
    roundId: null,
    status: 'waiting',
    currentMultiplier: 1.00,
    hash: null,
    startedAt: null,
    bets: []
  });

  const [betAmount, setBetAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('BTC');
  const [autoCashOut, setAutoCashOut] = useState('');
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [userBet, setUserBet] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [multiplierData, setMultiplierData] = useState([]);
  const [timeLabels, setTimeLabels] = useState([]);
  const [cryptoPrices, setCryptoPrices] = useState({});
  
  const chartRef = useRef();
  const currencies = ['BTC', 'ETH', 'LTC', 'ADA', 'DOT'];

  useEffect(() => {
    if (!socket) return;

    // Game state updates
    socket.on('game_state', (data) => {
      setGameState(data);
      setMultiplierData([data.currentMultiplier]);
      setTimeLabels([0]);
    });

    socket.on('new_round', (data) => {
      setGameState(prev => ({ ...prev, ...data }));
      setUserBet(null);
      setMultiplierData([1.00]);
      setTimeLabels([0]);
      toast.success(`New round started: ${data.roundId}`);
    });

    socket.on('game_started', (data) => {
      setGameState(prev => ({ ...prev, status: 'running', startedAt: data.startedAt }));
      toast.success('Game started! Watch the multiplier!');
    });

    socket.on('multiplier_update', (data) => {
      setGameState(prev => ({ ...prev, currentMultiplier: data.multiplier }));
      
      setMultiplierData(prev => {
        const newData = [...prev, data.multiplier];
        return newData.length > 100 ? newData.slice(-100) : newData;
      });
      
      setTimeLabels(prev => {
        const newLabels = [...prev, prev.length];
        return newLabels.length > 100 ? newLabels.slice(-100) : newLabels;
      });
    });

    socket.on('game_crashed', (data) => {
      setGameState(prev => ({ 
        ...prev, 
        status: 'crashed',
        currentMultiplier: data.crashPoint 
      }));
      
      if (userBet && !userBet.cashedOut) {
        toast.error(`Game crashed at ${data.crashPoint}x! You lost $${userBet.usdAmount}`);
      }
      
      // Fetch updated game history
      socket.emit('get_game_history', { limit: 10 });
    });

    socket.on('bet_placed_success', (data) => {
      setUserBet(data.bet);
      toast.success(`Bet placed: $${data.bet.usdAmount} ${data.bet.currency}`);
    });

    socket.on('player_cashout', (data) => {
      if (data.username === user.username) {
        toast.success(`Cashed out at ${data.multiplier}x for $${data.usdPayout.toFixed(2)}!`);
        setUserBet(prev => ({ ...prev, cashedOut: true, cashedOutAt: data.multiplier }));
      } else {
        toast.info(`${data.username} cashed out at ${data.multiplier}x`);
      }
    });

    socket.on('game_history', (history) => {
      setGameHistory(history);
    });

    socket.on('error', (error) => {
      toast.error(error.message);
    });

    // Fetch initial data
    socket.emit('get_game_history', { limit: 10 });
    
    return () => {
      socket.off('game_state');
      socket.off('new_round');
      socket.off('game_started');
      socket.off('multiplier_update');
      socket.off('game_crashed');
      socket.off('bet_placed_success');
      socket.off('player_cashout');
      socket.off('game_history');
      socket.off('error');
    };
  }, [socket, user.username, userBet]);

  const placeBet = () => {
    if (!betAmount || betAmount < 0.01) {
      toast.error('Please enter a valid bet amount');
      return;
    }

    if (gameState.status !== 'waiting') {
      toast.error('Cannot place bet at this time');
      return;
    }

    const betData = {
      usdAmount: parseFloat(betAmount),
      currency: selectedCurrency,
      autoCashOut: autoCashOut ? parseFloat(autoCashOut) : null
    };

    socket.emit('place_bet', betData);
  };

  const cashOut = () => {
    if (!userBet || userBet.cashedOut) {
      toast.error('No active bet to cash out');
      return;
    }

    if (gameState.status !== 'running') {
      toast.error('Cannot cash out at this time');
      return;
    }

    socket.emit('cashout');
  };

  const chartData = {
    labels: timeLabels,
    datasets: [
      {
        label: 'Multiplier',
        data: multiplierData,
        borderColor: gameState.status === 'crashed' ? '#ef4444' : '#8b5cf6',
        backgroundColor: gameState.status === 'crashed' ? '#ef444420' : '#8b5cf620',
        borderWidth: 3,
        tension: 0.1,
        pointRadius: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#e2e8f0',
          callback: function(value) {
            return value.toFixed(2) + 'x';
          }
        }
      },
    },
    animation: {
      duration: 0,
    },
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-purple-400">CRASH</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">Balance: {user.wallets?.find(w => w.currency === selectedCurrency)?.balance?.toFixed(6) || '0.000000'} {selectedCurrency}</span>
            <button 
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Game Status */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-sm">Next round in</p>
                  <p className="text-xl font-semibold">
                    {gameState.status === 'waiting' ? 'Waiting for bets...' : 
                     gameState.status === 'running' ? 'Game running!' : 
                     'Game crashed!'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Round ID</p>
                  <p className="text-sm font-mono">{gameState.roundId || 'Loading...'}</p>
                </div>
              </div>
            </div>

            {/* Multiplier Chart */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="relative h-80 mb-6">
                {gameState.status === 'crashed' && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-6xl font-bold text-red-500">
                      CRASHED
                    </div>
                  </div>
                )}
                <div className="absolute top-4 left-4 z-20">
                  <div className={`text-6xl font-bold ${
                    gameState.status === 'crashed' ? 'text-red-500' : 'text-purple-400'
                  }`}>
                    {gameState.currentMultiplier.toFixed(2)}x
                  </div>
                </div>
                <Line ref={chartRef} data={chartData} options={chartOptions} />
              </div>
            </div>

          </div>

          {/* Betting Panel */}
          <div className="space-y-6">
            
            {/* Bet Controls */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex space-x-2 mb-6">
                <button 
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    !isAutoMode ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                  onClick={() => setIsAutoMode(false)}
                >
                  Manual
                </button>
                <button 
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    isAutoMode ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                  onClick={() => setIsAutoMode(true)}
                >
                  Auto
                </button>
              </div>

              <div className="space-y-4">
                {/* Currency Selection */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Currency</label>
                  <select 
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    {currencies.map(currency => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </div>

                {/* Bet Amount */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Bet (USD)</label>
                  <input 
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Auto Cash Out */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Auto Cash Out</label>
                  <div className="flex">
                    <input 
                      type="number"
                      value={autoCashOut}
                      onChange={(e) => setAutoCashOut(e.target.value)}
                      placeholder="2.00"
                      min="1.01"
                      step="0.01"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-l-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    />
                    <div className="bg-gray-600 px-3 py-2 rounded-r-lg border border-gray-600 border-l-0 text-gray-300">
                      x
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4">
                  {userBet && !userBet.cashedOut && gameState.status === 'running' ? (
                    <button 
                      onClick={cashOut}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      Cash Out ({gameState.currentMultiplier.toFixed(2)}x)
                    </button>
                  ) : (
                    <button 
                      onClick={placeBet}
                      disabled={gameState.status !== 'waiting' || !betAmount}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
                    >
                      {gameState.status === 'waiting' ? 'Place Bet' : 'Game Running...'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Current Bet Info */}
            {userBet && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Your Bet</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span>${userBet.usdAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Currency:</span>
                    <span>{userBet.currency}</span>
                  </div>
                  {userBet.autoCashOut && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Auto Cash Out:</span>
                      <span>{userBet.autoCashOut}x</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-400">Status:</span>
                    <span className={userBet.cashedOut ? 'text-green-400' : 'text-yellow-400'}>
                      {userBet.cashedOut ? `Cashed out at ${userBet.cashedOutAt}x` : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Game History */}
        <div className="mt-8 bg-gray-800 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4">Game History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="text-left py-3">Time</th>
                  <th className="text-left py-3">Crashed at</th>
                  <th className="text-left py-3">Bet</th>
                  <th className="text-left py-3">Payout</th>
                  <th className="text-left py-3">Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.map((game, index) => {
                  const userGameBet = game.bets?.find(bet => bet.username === user.username);
                  return (
                    <tr key={game.roundId} className="border-b border-gray-700 hover:bg-gray-750">
                      <td className="py-3">
                        {new Date(game.crashedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 font-semibold">
                        <span className={`${
                          game.crashPoint < 2 ? 'text-red-400' : 
                          game.crashPoint < 10 ? 'text-yellow-400' : 
                          'text-green-400'
                        }`}>
                          {game.crashPoint}x
                        </span>
                      </td>
                      <td className="py-3">
                        {userGameBet ? `$${userGameBet.usdAmount.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3">
                        {userGameBet ? 
                          userGameBet.cashedOut ? 
                            `$${userGameBet.payout.toFixed(2)}` : 
                            '-' : 
                          '-'
                        }
                      </td>
                      <td className={`py-3 font-semibold ${
                        userGameBet?.profit > 0 ? 'text-green-400' : 
                        userGameBet?.profit < 0 ? 'text-red-400' : 
                        'text-gray-400'
                      }`}>
                        {userGameBet ? 
                          userGameBet.profit > 0 ? 
                            `+$${userGameBet.profit.toFixed(2)}` : 
                            `$${userGameBet.profit.toFixed(2)}` : 
                          '-'
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
                