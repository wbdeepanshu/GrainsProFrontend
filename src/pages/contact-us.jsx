import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Send, Loader2, Phone, MessageSquare, Mail, Clock, Headphones } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import logo from '../assets/gp_logo1.png';

export default function ContactUs() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [animatedElements, setAnimatedElements] = useState([]);

    // Initialize animated background elements
    useEffect(() => {
        const elements = Array.from({ length: 8 }, (_, i) => ({
            id: i,
            size: Math.random() * 60 + 20,
            left: Math.random() * 100,
            delay: Math.random() * 4,
            duration: Math.random() * 10 + 10,
        }));
        setAnimatedElements(elements);
    }, []);

    // Form state
    const [formData, setFormData] = useState({
        mobile: '',
        subject: '',
        message: ''
    });

    // Static subject options
    const subjectOptions = [
        'General Inquiry',
        'Technical Support',
        'Feature Request',
        'Bug Report',
        'Account Issue',
        'Billing Question',
        'Other'
    ];

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.mobile || !formData.subject || !formData.message) {
            toast({
                title: "Validation Error",
                description: "Please fill in all fields.",
                variant: "destructive"
            });
            return;
        }

        // Mobile number validation (basic)
        const mobileRegex = /^[0-9]{10}$/;
        if (!mobileRegex.test(formData.mobile)) {
            toast({
                title: "Validation Error",
                description: "Please enter a valid 10-digit mobile number.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // TODO: Replace with actual API endpoint when backend is ready
            // const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            // const response = await apiRequest('POST', `${API_BASE_URL}/api/contact-us/`, formData);
            
            // Simulate API call for now
            await new Promise(resolve => setTimeout(resolve, 1000));

            toast({
                title: "Success",
                description: "Your message has been sent successfully. We'll get back to you soon!",
            });

            // Reset form
            setFormData({
                mobile: '',
                subject: '',
                message: ''
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to send message. Please try again later.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-black overflow-y-auto">
                {/* Animated Background Elements */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                    {animatedElements.map((element) => (
                        <div
                            key={element.id}
                            className="absolute bg-white bg-opacity-5 rounded-full animate-float"
                            style={{
                                width: `${element.size}px`,
                                height: `${element.size}px`,
                                left: `${element.left}%`,
                                '--delay': `${element.delay}s`,
                                '--duration': `${element.duration}s`,
                            }}
                        />
                    ))}
                </div>

                {/* Geometric shapes */}
                <div className="fixed top-10 left-10 w-32 h-32 border border-white border-opacity-20 rotate-45 animate-spin-slow pointer-events-none z-0"></div>
                <div className="fixed bottom-10 right-10 w-24 h-24 border border-white border-opacity-20 rotate-12 animate-pulse-gentle pointer-events-none z-0"></div>
                <div className="fixed top-1/3 right-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-bounce-gentle pointer-events-none z-0"></div>
                <div className="fixed bottom-1/4 left-20 w-20 h-20 border border-white border-opacity-15 rotate-45 animate-pulse-gentle pointer-events-none z-0"></div>
                <div className="fixed top-1/2 left-1/4 w-12 h-12 bg-white bg-opacity-8 rounded-full animate-bounce-gentle pointer-events-none z-0"></div>

                {/* Content - Redesigned with attractive layout */}
                <div className="relative z-10 w-full">
                    <div className="py-8 md:py-12 px-4 md:px-6 lg:px-8">
                        <div className="w-full max-w-6xl mx-auto space-y-8">
                            {/* GrainPro Logo and Get In Touch - Side by Side */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center mb-8">
                                {/* GrainPro Logo and Name */}
                                <div className="text-center md:text-left animate-fade-in-down">
                                    <div className="flex justify-center md:justify-start mb-4">
                                        <div className="bg-gradient-to-r from-black to-gray-600 p-3 rounded-full animate-bounce-gentle">
                                            <div className="bg-white p-4 rounded-full">
                                                <img src={logo} alt="GrainsPro Logo" style={{ width: "80px", height: "80px" }} />
                                            </div>
                                        </div>
                                    </div>
                                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 animate-fade-in">
                                        GrainsPro ERP
                                    </h1>
                                    <p className="text-gray-300 text-sm md:text-base animate-fade-in-up">
                                        Enterprise Resource Planning
                                    </p>
                                </div>

                                {/* Get In Touch Section */}
                                <div className="text-center md:text-right animate-fade-in-down">
                                    <div className="flex justify-center md:justify-end mb-4">
                                        <div className="bg-gradient-to-r from-black to-gray-600 p-3 rounded-full animate-bounce-gentle">
                                            <div className="bg-white p-4 rounded-full">
                                                <Headphones className="h-12 w-12 text-gray-900" />
                                            </div>
                                        </div>
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-3 animate-fade-in">
                                        Get In Touch
                                    </h2>
                                    <p className="text-gray-300 text-lg md:text-xl animate-fade-in-up">
                                        We're here to help! Reach out to us and we'll respond as soon as possible.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Contact Information Cards */}
                                <div className="lg:col-span-1 space-y-4">
                                    <Card className="shadow-xl border border-white border-opacity-20 backdrop-blur-md bg-white bg-opacity-90 animate-slide-in-left hover:bg-opacity-95 transition-all duration-300">
                                        <CardContent className="p-6">
                                            <div className="flex items-start space-x-4">
                                                <div className="bg-gradient-to-r from-gray-900 to-black p-3 rounded-lg">
                                                    <Phone className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
                                                    <p className="text-gray-600 text-sm">Available 24/7</p>
                                                    <p className="text-gray-800 font-medium mt-1">+91 8867792369</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="shadow-xl border border-white border-opacity-20 backdrop-blur-md bg-white bg-opacity-90 animate-slide-in-left hover:bg-opacity-95 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
                                        <CardContent className="p-6">
                                            <div className="flex items-start space-x-4">
                                                <div className="bg-gradient-to-r from-gray-900 to-black p-3 rounded-lg">
                                                    <Mail className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
                                                    <p className="text-gray-600 text-sm">Send us an email</p>
                                                    <p className="text-gray-800 font-medium mt-1">support@wbtechindia.com</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="shadow-xl border border-white border-opacity-20 backdrop-blur-md bg-white bg-opacity-90 animate-slide-in-left hover:bg-opacity-95 transition-all duration-300" style={{ animationDelay: '0.2s' }}>
                                        <CardContent className="p-6">
                                            <div className="flex items-start space-x-4">
                                                <div className="bg-gradient-to-r from-gray-900 to-black p-3 rounded-lg">
                                                    <Clock className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900 mb-1">Response Time</h3>
                                                    <p className="text-gray-600 text-sm">We typically reply within</p>
                                                    <p className="text-gray-800 font-medium mt-1">24 hours</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Contact Form */}
                                <div className="lg:col-span-2">
                                    <Card className="shadow-2xl border border-white border-opacity-20 backdrop-blur-md bg-white bg-opacity-90 animate-slide-up hover:bg-opacity-95 transition-all duration-500 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)]">
                                        <CardHeader className="pb-6 border-b border-gray-200">
                                            <div className="flex items-center space-x-3">
                                                <div className="bg-gradient-to-r from-gray-900 to-black p-2 rounded-lg">
                                                    <MessageSquare className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-2xl font-bold text-gray-900">
                                                        Send us a Message
                                                    </CardTitle>
                                                    <p className="text-gray-600 text-sm mt-1">
                                                        Fill out the form below and we'll get back to you
                                                    </p>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-6">
                                            <form onSubmit={handleSubmit} className="space-y-5">
                                                {/* Mobile Number Field */}
                                                <div className="space-y-2 animate-slide-in-right">
                                                    <Label htmlFor="mobile" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                                                        <Phone className="h-4 w-4" />
                                                        <span>Mobile Number *</span>
                                                    </Label>
                                                    <Input
                                                        id="mobile"
                                                        type="tel"
                                                        placeholder="Enter your 10-digit mobile number"
                                                        value={formData.mobile}
                                                        onChange={(e) => {
                                                            // Only allow numbers, no characters
                                                            const onlyNumbers = e.target.value.replace(/[^0-9]/g, "");
                                                            handleInputChange('mobile', onlyNumbers);
                                                        }}
                                                        maxLength={10}
                                                        required
                                                        className="w-full h-12 text-base bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md"
                                                    />
                                                </div>

                                                {/* Subject Dropdown */}
                                                <div className="space-y-2 animate-slide-in-right" style={{ animationDelay: '0.1s' }}>
                                                    <Label htmlFor="subject" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                                                        <Mail className="h-4 w-4" />
                                                        <span>Subject *</span>
                                                    </Label>
                                                    <Select
                                                        value={formData.subject}
                                                        onValueChange={(value) => handleInputChange('subject', value)}
                                                        required
                                                    >
                                                        <SelectTrigger 
                                                            id="subject" 
                                                            className="w-full h-12 text-base bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md"
                                                        >
                                                            <SelectValue placeholder="Select a subject" />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-white backdrop-blur-md">
                                                            {subjectOptions.map((option) => (
                                                                <SelectItem key={option} value={option} className="hover:bg-gray-100 transition-colors cursor-pointer">
                                                                    {option}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Message Text Field */}
                                                <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                                                    <Label htmlFor="message" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                                                        <MessageSquare className="h-4 w-4" />
                                                        <span>Message *</span>
                                                    </Label>
                                                    <Textarea
                                                        id="message"
                                                        placeholder="Tell us how we can help you..."
                                                        value={formData.message}
                                                        onChange={(e) => handleInputChange('message', e.target.value)}
                                                        rows={6}
                                                        required
                                                        className="w-full resize-none text-base bg-white border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-300 hover:shadow-md"
                                                    />
                                                </div>

                                                {/* Submit Button */}
                                                <div className="flex justify-end pt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                                    <Button
                                                        type="submit"
                                                        disabled={isSubmitting}
                                                        className="min-w-[160px] h-12 text-base font-semibold bg-gradient-to-r from-gray-900 to-black text-white shadow-lg hover:opacity-90 transition-all duration-300 transform hover:scale-105 hover:shadow-xl focus:ring-4 focus:ring-gray-300 rounded-lg"
                                                    >
                                                        {isSubmitting ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                Sending...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Send className="mr-2 h-4 w-4" />
                                                                Send Message
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </form>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        </div>
    );
}

