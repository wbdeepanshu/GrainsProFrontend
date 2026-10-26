import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Keyboard, LogOut } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { useLocation } from "wouter";
import { KEYBOARD_SHORTCUTS_PATH } from "@/lib/appShortcuts";


interface UserInfo {
  user_id: string;
  name: string;
  admin_id: string;
  role_id: number;
  role: string;
  is_admin: boolean;
  organization: string;
  branch: string;
}

interface UserInfoCardProps {
  user?: UserInfo;
  tallyRunning?: boolean;
}

export default function UserInfoCard({ user, tallyRunning = false }: UserInfoCardProps) {
  // const navigate = useNavigate();
  const [, setLocation] = useLocation();
  const handleLogout = () => {
    AuthService.logout();
    // navigate('/GrainPro');
    setLocation("/");
  };

  if (!user) {
    return (
      <Card className="shadow-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <CardContent className="p-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3 text-slate-500">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-lg font-medium">Loading user information...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="p-4">
        {/* User Header */}
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
          <div className="w-12 h-12 bg-gradient-to-r from-black to-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-lg">
              {user.name.split(" ").map(n => n[0]).join("")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{user.role}</h3>
            {/* <p className="text-sm text-gray-500">{user.role}</p> */}
          </div>
        </div>

        {/* Organization Info */}
        <div className="py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Organization</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{user.organization}</p>
            </div>
          </div>
          
          {/* <div className="flex items-center space-x-3 mt-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Branch</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{user.branch}</p>
            </div>
          </div> */}
        </div>

        {/* Tally Status */}
        {/* <div className="py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Circle className={`w-4 h-4 ${tallyRunning ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tally Status</p>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${tallyRunning ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <p className="text-sm font-semibold text-gray-900">
                  {tallyRunning ? 'Running' : 'Stopped'}
                </p>
              </div>
            </div>
          </div>
        </div> */}

        <div className="pt-4 space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation(KEYBOARD_SHORTCUTS_PATH)}
            className="w-full flex items-center justify-center space-x-2 border-blue-200 text-blue-900 hover:bg-blue-50"
          >
            <Keyboard className="w-4 h-4" />
            <span>Keyboard shortcuts</span>
          </Button>
          <Button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-black to-gray-600 hover:from-gray-800 hover:to-gray-700 text-white"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
