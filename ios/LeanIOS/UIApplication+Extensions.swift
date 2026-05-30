//
//  UIApplication+Extensions.swift
//  GonativeIO
//
//  Created by bld on 8/24/23.
//  Copyright © 2023 GoNative.io LLC. All rights reserved.
//

extension UIApplication {
    @objc public var currentKeyWindow: UIWindow? {
        return connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .last { $0.isKeyWindow }
    }
    
    @objc public var currentStatusBarFrame: CGRect {
        return currentKeyWindow?.windowScene?.statusBarManager?.statusBarFrame ?? CGRect()
    }
    
    @objc public var isInterfaceOrientationPortrait: Bool {
        let interfaceOrientation = currentKeyWindow?.windowScene?.interfaceOrientation
        return interfaceOrientation != nil && interfaceOrientation!.isPortrait
    }
}
