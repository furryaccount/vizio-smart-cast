
interface SmartcastPower {
    currentMode(): Promise<any>;
}

interface SmartcastPairing {
    initiate(deviceName?: string, deviceId?: string): Promise<any>;
    pair(pin: string): Promise<any>;
    useAuthToken(token: string): void;
}

interface SmartcastInput {
    current(): Promise<any>;
    list(): Promise<any>;
    set(name: string): Promise<any>;
}

interface SmartcastControl {
    volume: SmartcastControlVolume;
    input: SmartcastControlInput;
    channel: SmartcastControlChannel;
    power: SmartcastControlPower;
    keyCommand(codeset: number, code: number, action?: string): Promise<any>;
}

interface SmartcastControlVolume {
    up(): Promise<any>;
    down(): Promise<any>;
    set(): Promise<any>;
    mute(): Promise<any>;
    unmute(): Promise<any>;
    toggleMute(): Promise<any>;
}

interface SmartcastControlInput {
    cycle(): Promise<any>;
}

interface SmartcastControlChannel {
    up(): Promise<any>;
    down(): Promise<any>;
    previous(): Promise<any>;
}

interface SmartcastControlPower {
    on(): Promise<any>;
    off(): Promise<any>;
    toggle(): Promise<any>;
}

interface SmartcastTimers {
    get(): Promise<any>;
    sleepTimer: SmartcastGetSet;
    autoPowerOffTimer: SmartcastGetSet;
    blankScreen: SmartcastGetExecute;
}

interface SmartcastGet {
    get(): Promise<any>;
}

interface SmartcastGetSet {
    get(): Promise<any>;
    set(value: string): Promise<any>;
}

interface SmartcastGetExecute {
    get(): Promise<any>;
    execute(): Promise<any>;
}


declare namespace smartcast {
    export interface Device {
        discover: (success: (discovery: Discovery) => void, error?: (error: any) => void, timeout?: number) => void;
        new(ip: string, authKey?: string): Device;
        
        power: SmartcastPower;
        pairing: SmartcastPairing;
        input: SmartcastInput;
        control: SmartcastControl;
    }

    export interface Discovery {
        ip: string;
        name: string;
        manufacturer: string;
        model: string;
    }
}

declare var smartcast: smartcast.Device;

export = smartcast;
