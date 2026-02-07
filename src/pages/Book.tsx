import React from 'react';

const Book: React.FC = () => {
    return (
        <div className="bg-background min-h-screen text-foreground font-display overflow-x-hidden selection:bg-primary selection:text-black">
            {/* Background Ambient Effects */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[150px]"></div>
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-bronze/5 blur-[150px]"></div>
            </div>

            {/* Placeholder: Coming Soon */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4">
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-4">
                    Soon
                </h1>
                <p className="text-muted text-lg md:text-xl text-center max-w-md">
                    This page is in the works. Check back later.
                </p>
            </div>
        </div>
    );
};

export default Book;
